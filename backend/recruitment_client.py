import grpc

import resume_analyzer_pb2
import resume_analyzer_pb2_grpc


def get_role_requirements(stub, role_name):
    request = resume_analyzer_pb2.RoleRequest(
        role_name=role_name
    )

    response = stub.GetRoleRequirements(request)

    print("\nRequired Skills")
    print("---------------")
    print(f"Role: {response.role_name}")
    print(
        "Skills: "
        + ", ".join(response.required_skills)
    )


def analyze_candidate(stub):
    candidate_request = (
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
            experience_years=3
        )
    )

    response = stub.AnalyzeCandidate(
        candidate_request
    )

    print("\nCandidate Analysis Result")
    print("-------------------------")
    print(f"Candidate Name: {response.candidate_name}")
    print(f"Email: {response.email}")
    print(f"Target Role: {response.target_role}")
    print(f"Resume Score: {response.score}%")

    print(
        "Matched Skills: "
        + ", ".join(response.matched_skills)
    )

    if response.missing_skills:
        print(
            "Missing Skills: "
            + ", ".join(response.missing_skills)
        )
    else:
        print("Missing Skills: None")

    print(
        f"Recommendation: "
        f"{response.recommendation}"
    )


def run_client():
    try:
        with grpc.insecure_channel(
            "localhost:50051"
        ) as channel:
            stub = (
                resume_analyzer_pb2_grpc
                .ResumeAnalyzerServiceStub(channel)
            )

            print("Connected to Resume Analyzer Server")

            get_role_requirements(
                stub,
                "Full Stack Developer"
            )

            analyze_candidate(stub)

    except grpc.RpcError as error:
        print("\nRPC communication failed")
        print(f"Status Code: {error.code()}")
        print(f"Error Details: {error.details()}")

    except Exception as error:
        print(f"\nUnexpected error: {error}")


if __name__ == "__main__":
    run_client()