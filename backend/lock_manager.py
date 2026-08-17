import sys
import threading
import time
from concurrent import futures

import grpc

import resume_analyzer_pb2
import resume_analyzer_pb2_grpc


# Run with:
# python3 lock_manager.py
#
# OR:
#
# python3 lock_manager.py detect
#
# The second mode enables deadlock detection.

DETECT = len(sys.argv) > 1 and sys.argv[1] == "detect"


class LockManager(
    resume_analyzer_pb2_grpc.LockServiceServicer
):

    def __init__(self):

        # Protects the lock manager's internal data.
        self.mutex = threading.Lock()

        # Resource -> current owner
        #
        # None means the resource is free.
        self.locks = {
            "candidate_data": None,
            "shortlist": None
        }

        # Node -> resource it is currently waiting for
        self.wait_for = {}

        # Conditions allow waiting workers
        # to be notified when a resource is released.
        self.conditions = {
            "candidate_data": threading.Condition(),
            "shortlist": threading.Condition()
        }


    def _would_create_cycle(self, requester, resource):

        """
        Check whether giving the requester a wait
        relationship for 'resource' would create
        a circular wait.
        """

        visited = set()

        current_resource = resource

        while True:

            owner = self.locks.get(current_resource)

            # Resource is free.
            if owner is None:
                return False

            # The requester already owns the resource.
            if owner == requester:
                return True

            # We have already visited this node.
            if owner in visited:
                return False

            visited.add(owner)

            # What resource is this owner waiting for?
            current_resource = self.wait_for.get(owner)

            # Owner is not waiting for anything.
            if current_resource is None:
                return False


    def AcquireLock(self, request, context):

        resource = request.resource_id
        holder = request.holder_id

        if resource not in self.locks:

            return resume_analyzer_pb2.LockReply(
                granted=False,
                message="unknown-resource"
            )

        condition = self.conditions[resource]

        with condition:

            with self.mutex:

                owner = self.locks[resource]

                # -------------------------------------------------
                # CASE 1: Resource is free
                # -------------------------------------------------

                if owner is None:

                    self.locks[resource] = holder

                    self.wait_for.pop(holder, None)

                    print(
                        f"[LockManager] "
                        f"Node-{holder} ACQUIRED "
                        f"'{resource}'"
                    )

                    return resume_analyzer_pb2.LockReply(
                        granted=True,
                        message="granted"
                    )


                # -------------------------------------------------
                # CASE 2: Resource already belongs to this node
                # -------------------------------------------------

                if owner == holder:

                    return resume_analyzer_pb2.LockReply(
                        granted=True,
                        message="already-owned"
                    )


                # -------------------------------------------------
                # CASE 3: Resource is busy
                # -------------------------------------------------

                if DETECT:

                    creates_cycle = (
                        self._would_create_cycle(
                            holder,
                            resource
                        )
                    )

                    if creates_cycle:

                        print()
                        print(
                            "[LockManager] "
                            "=============================="
                        )

                        print(
                            "[LockManager] "
                            "DEADLOCK DETECTED!"
                        )

                        print(
                            f"[LockManager] "
                            f"Node-{holder} wants "
                            f"'{resource}'"
                        )

                        print(
                            f"[LockManager] "
                            f"'{resource}' is held by "
                            f"Node-{owner}"
                        )

                        print(
                            f"[LockManager] "
                            f"Aborting Node-{holder}"
                        )

                        print(
                            "[LockManager] "
                            "=============================="
                        )

                        print()

                        return resume_analyzer_pb2.LockReply(
                            granted=False,
                            message="deadlock-abort"
                        )


                # -------------------------------------------------
                # No deadlock detected.
                # Put this node into waiting state.
                # -------------------------------------------------

                self.wait_for[holder] = resource

                print(
                    f"[LockManager] "
                    f"Node-{holder} WAITING for "
                    f"'{resource}' "
                    f"(held by Node-{owner})"
                )


            # -----------------------------------------------------
            # Wait until the resource becomes available.
            # -----------------------------------------------------

            while True:

                with self.mutex:

                    owner = self.locks[resource]

                    if owner is None:

                        self.locks[resource] = holder

                        self.wait_for.pop(
                            holder,
                            None
                        )

                        print(
                            f"[LockManager] "
                            f"Node-{holder} ACQUIRED "
                            f"'{resource}' after waiting"
                        )

                        return resume_analyzer_pb2.LockReply(
                            granted=True,
                            message="granted-after-wait"
                        )

                condition.wait(timeout=1)


    def ReleaseLock(self, request, context):

        resource = request.resource_id
        holder = request.holder_id

        if resource not in self.locks:

            return resume_analyzer_pb2.LockReply(
                granted=False,
                message="unknown-resource"
            )

        condition = self.conditions[resource]

        with condition:

            with self.mutex:

                # Only the actual owner can release it.
                if self.locks[resource] == holder:

                    self.locks[resource] = None

                    print(
                        f"[LockManager] "
                        f"Node-{holder} RELEASED "
                        f"'{resource}'"
                    )

            # Wake up waiting workers.
            condition.notify_all()

        return resume_analyzer_pb2.LockReply(
            granted=True,
            message="released"
        )


def serve():

    server = grpc.server(
        futures.ThreadPoolExecutor(
            max_workers=10
        )
    )

    resume_analyzer_pb2_grpc \
        .add_LockServiceServicer_to_server(
            LockManager(),
            server
        )

    server.add_insecure_port(
        "localhost:60100"
    )

    server.start()

    print()
    print(
        "========================================"
    )
    print(
        " AI RESUME ANALYZER - LOCK MANAGER"
    )
    print(
        "========================================"
    )

    print(
        "Running on localhost:60100"
    )

    print(
        f"Deadlock detection = {DETECT}"
    )

    print()

    try:

        while True:
            time.sleep(86400)

    except KeyboardInterrupt:

        print()
        print("Stopping Lock Manager...")

        server.stop(0)


if __name__ == "__main__":
    serve()