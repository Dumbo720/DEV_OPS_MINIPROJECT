import sys
import time
import threading

from concurrent import futures

import grpc

import resume_analyzer_pb2
import resume_analyzer_pb2_grpc


# -----------------------------------------------------
# Three distributed Resume Analyzer nodes
# -----------------------------------------------------

PEERS = {
    1: "localhost:60051",
    2: "localhost:60052",
    3: "localhost:60053"
}


class Node:

    def __init__(self, node_id):

        self.id = node_id

        self.peers = {
            nid: address
            for nid, address in PEERS.items()
            if nid != node_id
        }

        # Lamport Logical Clock
        self.clock = 0

        # Ricart-Agrawala states:
        #
        # RELEASED -> not interested
        # WANTED   -> requesting critical section
        # HELD     -> currently inside critical section

        self.state = "RELEASED"

        self.request_time = None

        self.lock = threading.Lock()

        # Requests whose responses are being deferred
        self.deferred = []


    # -------------------------------------------------
    # Lamport Clock
    # -------------------------------------------------

    def tick(self):

        with self.lock:
            self.clock += 1
            return self.clock


    def update(self, received_timestamp):

        with self.lock:

            self.clock = max(
                self.clock,
                received_timestamp
            ) + 1

            return self.clock


    # -------------------------------------------------
    # Start gRPC server
    # -------------------------------------------------

    def serve(self):

        server = grpc.server(
            futures.ThreadPoolExecutor(
                max_workers=10
            )
        )

        resume_analyzer_pb2_grpc \
            .add_MutexServiceServicer_to_server(
                MutexServicer(self),
                server
            )

        server.add_insecure_port(
            PEERS[self.id]
        )

        server.start()

        print(
            f"Node-{self.id}: gRPC server started "
            f"on {PEERS[self.id]}"
        )

        return server


    # -------------------------------------------------
    # Contact another node
    # -------------------------------------------------

    def call_peer(
        self,
        peer_id,
        address,
        timestamp,
        max_wait=30
    ):

        deadline = time.time() + max_wait

        while time.time() < deadline:

            try:

                with grpc.insecure_channel(
                    address
                ) as channel:

                    stub = (
                        resume_analyzer_pb2_grpc
                        .MutexServiceStub(channel)
                    )

                    response = stub.RequestAccess(
                        resume_analyzer_pb2.AccessRequest(
                            node_id=self.id,
                            timestamp=timestamp
                        )
                    )

                    return response

            except grpc.RpcError:

                # Peer may not have started yet.
                time.sleep(0.5)

        raise RuntimeError(
            f"Node-{self.id}: "
            f"Could not reach Node-{peer_id}"
        )


    # -------------------------------------------------
    # Request Critical Section
    # -------------------------------------------------

    def request_critical_section(self):

        # Lamport timestamp for our request
        my_timestamp = self.tick()

        with self.lock:

            self.state = "WANTED"
            self.request_time = my_timestamp

        print()
        print(
            f"Node-{self.id}: WANTS candidate "
            f"shortlisting slot"
        )

        print(
            f"Node-{self.id}: Request timestamp = "
            f"{my_timestamp}"
        )

        # Ask every other peer for permission.
        for peer_id, address in self.peers.items():

            print(
                f"Node-{self.id}: Requesting permission "
                f"from Node-{peer_id}"
            )

            reply = self.call_peer(
                peer_id,
                address,
                my_timestamp
            )

            updated_clock = self.update(
                reply.timestamp
            )

            print(
                f"Node-{self.id}: GRANT received "
                f"from Node-{reply.node_id}"
            )

            print(
                f"Node-{self.id}: Lamport clock = "
                f"{updated_clock}"
            )

        # All peers granted permission.
        with self.lock:
            self.state = "HELD"

        print()
        print(
            f">>> Node-{self.id}: ENTERED "
            f"CRITICAL SECTION"
        )

        print(
            f"Node-{self.id}: Finalizing candidate "
            f"shortlisting..."
        )

        # Keep it long enough to make contention visible.
        time.sleep(2)

        print(
            f"<<< Node-{self.id}: LEAVING "
            f"CRITICAL SECTION"
        )

        self.release_critical_section()


    # -------------------------------------------------
    # Release Critical Section
    # -------------------------------------------------

    def release_critical_section(self):

        with self.lock:

            self.state = "RELEASED"
            self.request_time = None

            events_to_release = self.deferred
            self.deferred = []

        print(
            f"Node-{self.id}: RELEASED candidate "
            f"shortlisting slot"
        )

        # Allow deferred peer RPCs to finally return.
        for event in events_to_release:
            event.set()


# -----------------------------------------------------
# gRPC Mutex Service
# -----------------------------------------------------

class MutexServicer(
    resume_analyzer_pb2_grpc.MutexServiceServicer
):

    def __init__(self, node):
        self.node = node


    def RequestAccess(
        self,
        request,
        context
    ):

        node = self.node

        # Update Lamport clock on receive.
        updated_clock = node.update(
            request.timestamp
        )

        print()
        print(
            f"Node-{node.id}: REQUEST received "
            f"from Node-{request.node_id}"
        )

        print(
            f"Node-{node.id}: Received timestamp = "
            f"{request.timestamp}"
        )

        print(
            f"Node-{node.id}: Local clock = "
            f"{updated_clock}"
        )

        # ------------------------------------------------
        # Ricart-Agrawala priority decision
        # ------------------------------------------------

        with node.lock:

            defer = (

                # We are already using the resource.
                node.state == "HELD"

                or

                # We also want it AND our request has
                # higher priority.
                (
                    node.state == "WANTED"

                    and

                    (
                        node.request_time,
                        node.id
                    )
                    <
                    (
                        request.timestamp,
                        request.node_id
                    )
                )
            )

        if defer:

            print(
                f"Node-{node.id}: DEFERS "
                f"Node-{request.node_id}"
            )

            event = threading.Event()

            with node.lock:
                node.deferred.append(event)

            # RPC response is intentionally blocked.
            event.wait()

            print(
                f"Node-{node.id}: Deferred request "
                f"from Node-{request.node_id} "
                f"is now GRANTED"
            )

        else:

            print(
                f"Node-{node.id}: GRANTS "
                f"Node-{request.node_id}"
            )

        # Sending response is another Lamport event.
        send_timestamp = node.tick()

        return resume_analyzer_pb2.AccessReply(
            node_id=node.id,
            timestamp=send_timestamp
        )


# -----------------------------------------------------
# Main
# -----------------------------------------------------

def main():

    if len(sys.argv) != 2:

        print(
            "Usage: python node.py <node_id>"
        )

        print(
            "Example: python node.py 1"
        )

        return


    node_id = int(
        sys.argv[1]
    )


    if node_id not in PEERS:

        print(
            "Node ID must be 1, 2, or 3"
        )

        return


    node = Node(
        node_id
    )

    server = node.serve()


    print(
        f"Node-{node_id}: Waiting for "
        f"other nodes..."
    )


    # Gives you time to start all 3 terminals.
    time.sleep(6)


    node.request_critical_section()


    # Give deferred RPCs time to finish.
    time.sleep(3)


    print(
        f"Node-{node_id}: Experiment complete"
    )


    server.stop(0)


if __name__ == "__main__":
    main()