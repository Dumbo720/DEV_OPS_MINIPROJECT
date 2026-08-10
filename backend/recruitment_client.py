import grpc

import resume_analyzer_pb2
import resume_analyzer_pb2_grpc

from lamport_clock import LamportClock


clock = LamportClock()


def get_role_requirements(stub):

    print(
        "\n========== GET ROLE REQUIREMENTS =========="
    )

    # Send event
    send_time = clock.send_event()

    print(
        f"Sending Request"
    )

    print(
        f"Client Lamport Clock : "
        f"{send_time}"
    )

    request = resume_analyzer_pb2.RoleRequest(
        role_name="Full Stack Developer",
        lamport_time=send_time
    )

    response = stub.GetRoleRequirements(
        request
    )

    # Receive event
    receive_time = clock.receive_event(
        response.lamport_time
    )

    print("\nReceived Response")

    print(
        f"Server Lamport Clock : "
        f"{response.lamport_time}"
    )

    print(
        f"Client Clock Updated : "
        f"{receive_time}"
    )

    print(
        f"Role                : "
        f"{response.role_name}"
    )

    print(
        "Required Skills     : "
        + ", ".join(
            response.required_skills
        )
    )


def analyze_candidate(stub):

    print(
        "\n========== ANALYZE CANDIDATE =========="
    )

    # Send event
    send_time = clock.send_event()

    print("Sending Request")

    print(
        f"Client Lamport Clock : "
        f"{send_time}"
    )

    request = (
        resume_analyzer_pb2.CandidateRequest(
            candidate_name="Hassaan Tole",
            email="hassaan@example.com",
            target_role="Full Stack Developer",

            skills=[
                "HTML",
                "CSS",
                "JavaScript",
                "React",
                "Node.js",
                "Git"
            ],

            experience_years=3,

            lamport_time=send_time
        )
    )

    response = stub.AnalyzeCandidate(
        request
    )

    # Receive event
    receive_time = clock.receive_event(
        response.lamport_time
    )

    print("\nReceived Response")

    print(
        f"Server Lamport Clock : "
        f"{response.lamport_time}"
    )

    print(
        f"Client Clock Updated : "
        f"{receive_time}"
    )

    print(
        f"Candidate Name       : "
        f"{response.candidate_name}"
    )

    print(
        f"Target Role          : "
        f"{response.target_role}"
    )

    print(
        f"Resume Score         : "
        f"{response.score}%"
    )

    print(
        "Matched Skills       : "
        + ", ".join(
            response.matched_skills
        )
    )

    print(
        "Missing Skills       : "
        + ", ".join(
            response.missing_skills
        )
    )

    print(
        f"Recommendation       : "
        f"{response.recommendation}"
    )


def run_client():

    try:

        with grpc.insecure_channel(
            "localhost:50051"
        ) as channel:

            stub = (
                resume_analyzer_pb2_grpc
                .ResumeAnalyzerServiceStub(
                    channel
                )
            )

            print(
                "Connected to Resume Analyzer Server"
            )

            get_role_requirements(
                stub
            )

            analyze_candidate(
                stub
            )

    except grpc.RpcError as error:

        print(
            "RPC communication failed"
        )

        print(
            f"Status Code: {error.code()}"
        )

        print(
            f"Details: {error.details()}"
        )


if __name__ == "__main__":
    run_client()