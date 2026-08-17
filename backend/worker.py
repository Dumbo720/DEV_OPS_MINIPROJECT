import sys
import time

import grpc

import resume_analyzer_pb2
import resume_analyzer_pb2_grpc


LOCK_MANAGER = "localhost:60100"


def acquire_lock(stub, resource, node_id):

    print(
        f"Node-{node_id}: requesting '{resource}'",
        flush=True
    )

    reply = stub.AcquireLock(
        resume_analyzer_pb2.LockRequest(
            resource_id=resource,
            holder_id=node_id,
            timestamp=node_id
        )
    )

    print(
        f"Node-{node_id}: '{resource}' -> "
        f"{reply.granted} ({reply.message})",
        flush=True
    )

    return reply.granted, reply.message


def release_lock(stub, resource, node_id):

    print(
        f"Node-{node_id}: releasing '{resource}'",
        flush=True
    )

    stub.ReleaseLock(
        resume_analyzer_pb2.LockRequest(
            resource_id=resource,
            holder_id=node_id,
            timestamp=node_id
        )
    )


def run_node_1():

    print()
    print("=" * 50)
    print("NODE 1 - RESUME UPDATE")
    print("=" * 50)

    with grpc.insecure_channel(LOCK_MANAGER) as channel:

        stub = (
            resume_analyzer_pb2_grpc
            .LockServiceStub(channel)
        )

        # -----------------------------------------
        # FIRST ATTEMPT
        # -----------------------------------------

        granted, message = acquire_lock(
            stub,
            "candidate_data",
            1
        )

        if not granted:
            print(
                "Node-1 could not acquire candidate_data"
            )
            return

        print(
            "Node-1: HOLDING candidate_data",
            flush=True
        )

        # Give Node 2 time to get shortlist.
        time.sleep(10)

        print(
            "Node-1: now requesting shortlist",
            flush=True
        )

        granted, message = acquire_lock(
            stub,
            "shortlist",
            1
        )

        # -----------------------------------------
        # DEADLOCK DETECTED
        # -----------------------------------------

        if not granted:

            if message == "deadlock-abort":

                print()
                print(
                    "Node-1: DEADLOCK ABORTED",
                    flush=True
                )

                # Release the resource we currently hold.
                release_lock(
                    stub,
                    "candidate_data",
                    1
                )

                print(
                    "Node-1: released candidate_data",
                    flush=True
                )

                print(
                    "Node-1: waiting before retry...",
                    flush=True
                )

                time.sleep(2)

                # ---------------------------------
                # RETRY
                # ---------------------------------

                print()
                print(
                    "Node-1: RETRYING",
                    flush=True
                )

                granted, _ = acquire_lock(
                    stub,
                    "candidate_data",
                    1
                )

                if not granted:
                    return

                granted, _ = acquire_lock(
                    stub,
                    "shortlist",
                    1
                )

                if not granted:
                    release_lock(
                        stub,
                        "candidate_data",
                        1
                    )

                    return

            else:

                return

        # -----------------------------------------
        # CRITICAL SECTION
        # -----------------------------------------

        print()
        print(
            ">>> Node-1 ENTERED CRITICAL SECTION",
            flush=True
        )

        print(
            "Node-1: Updating candidate resume data...",
            flush=True
        )

        time.sleep(2)

        print(
            "<<< Node-1 LEAVING CRITICAL SECTION",
            flush=True
        )

        # -----------------------------------------
        # RELEASE
        # -----------------------------------------

        release_lock(
            stub,
            "shortlist",
            1
        )

        release_lock(
            stub,
            "candidate_data",
            1
        )

        print(
            "Node-1: DONE",
            flush=True
        )


def run_node_2():

    print()
    print("=" * 50)
    print("NODE 2 - FINAL SHORTLIST")
    print("=" * 50)

    with grpc.insecure_channel(LOCK_MANAGER) as channel:

        stub = (
            resume_analyzer_pb2_grpc
            .LockServiceStub(channel)
        )

        # -----------------------------------------
        # Acquire first resource
        # -----------------------------------------

        granted, _ = acquire_lock(
            stub,
            "shortlist",
            2
        )

        if not granted:
            return

        print(
            "Node-2: HOLDING shortlist",
            flush=True
        )

        # Give Node 1 time to get candidate_data.
        time.sleep(10)

        print(
            "Node-2: now requesting candidate_data",
            flush=True
        )

        granted, _ = acquire_lock(
            stub,
            "candidate_data",
            2
        )

        # -----------------------------------------
        # Node 2 waits normally
        # -----------------------------------------

        if not granted:

            print(
                "Node-2: could not acquire "
                "candidate_data",
                flush=True
            )

            release_lock(
                stub,
                "shortlist",
                2
            )

            print(
                "Node-2: released shortlist",
                flush=True
            )

            # -------------------------------------
            # Retry
            # -------------------------------------

            print(
                "Node-2: waiting before retry...",
                flush=True
            )

            time.sleep(2)

            print(
                "Node-2: RETRYING",
                flush=True
            )

            granted, _ = acquire_lock(
                stub,
                "shortlist",
                2
            )

            if not granted:
                return

            granted, _ = acquire_lock(
                stub,
                "candidate_data",
                2
            )

            if not granted:

                release_lock(
                    stub,
                    "shortlist",
                    2
                )

                return

        # -----------------------------------------
        # CRITICAL SECTION
        # -----------------------------------------

        print()
        print(
            ">>> Node-2 ENTERED CRITICAL SECTION",
            flush=True
        )

        print(
            "Node-2: Finalizing candidate shortlist...",
            flush=True
        )

        time.sleep(2)

        print(
            "<<< Node-2 LEAVING CRITICAL SECTION",
            flush=True
        )

        # -----------------------------------------
        # RELEASE
        # -----------------------------------------

        release_lock(
            stub,
            "candidate_data",
            2
        )

        release_lock(
            stub,
            "shortlist",
            2
        )

        print(
            "Node-2: DONE",
            flush=True
        )


def main():

    if len(sys.argv) != 2:

        print(
            "Usage:"
        )

        print(
            "python3 worker.py 1"
        )

        print(
            "python3 worker.py 2"
        )

        sys.exit(1)

    node_id = int(sys.argv[1])

    if node_id == 1:

        run_node_1()

    elif node_id == 2:

        run_node_2()

    else:

        print(
            "Node ID must be 1 or 2"
        )


if __name__ == "__main__":
    main()