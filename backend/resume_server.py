from concurrent import futures

import grpc

import resume_analyzer_pb2
import resume_analyzer_pb2_grpc


ROLE_REQUIREMENTS = {
    "Frontend Developer": [
        "html",
        "css",
        "javascript",
        "react",
        "typescript",
        "git"
    ],
    "Backend Developer": [
        "node.js",
        "express.js",
        "python",
        "sql",
        "mongodb",
        "rest api"
    ],
    "Full Stack Developer": [
        "html",
        "css",
        "javascript",
        "react",
        "node.js",
        "sql",
        "git"
    ],
    "Data Analyst": [
        "python",
        "sql",
        "pandas",
        "numpy",
        "excel",
        "power bi"
    ],
    "DevOps Engineer": [
        "git",
        "docker",
        "jenkins",
        "aws",
        "linux",
        "ci/cd"
    ]
}


class ResumeAnalyzerService(
    resume_analyzer_pb2_grpc.ResumeAnalyzerServiceServicer
):
    def AnalyzeCandidate(self, request, context):
        target_role = request.target_role
        required_skills = ROLE_REQUIREMENTS.get(target_role)

        if required_skills is None:
            context.set_code(grpc.StatusCode.NOT_FOUND)
            context.set_details(
                f"The role '{target_role}' does not exist."
            )
            return resume_analyzer_pb2.CandidateResponse()

        candidate_skills = {
            skill.strip().lower()
            for skill in request.skills
        }

        matched_skills = [
            skill
            for skill in required_skills
            if skill.lower() in candidate_skills
        ]

        missing_skills = [
            skill
            for skill in required_skills
            if skill.lower() not in candidate_skills
        ]

        skill_score = (
            len(matched_skills) / len(required_skills)
        ) * 80

        experience_score = min(
            request.experience_years * 5,
            20
        )

        final_score = round(
            skill_score + experience_score,
            2
        )

        if final_score >= 80:
            recommendation = "Highly Recommended"
        elif final_score >= 60:
            recommendation = "Recommended"
        elif final_score >= 40:
            recommendation = "Consider for Interview"
        else:
            recommendation = "Not Recommended"

        print("\nCandidate analysis request received")
        print("-----------------------------------")
        print(f"Candidate Name: {request.candidate_name}")
        print(f"Email: {request.email}")
        print(f"Target Role: {request.target_role}")
        print(f"Candidate Skills: {list(request.skills)}")
        print(f"Experience: {request.experience_years} years")
        print(f"Calculated Score: {final_score}%")
        print(f"Recommendation: {recommendation}")

        return resume_analyzer_pb2.CandidateResponse(
            candidate_name=request.candidate_name,
            email=request.email,
            target_role=request.target_role,
            score=final_score,
            matched_skills=matched_skills,
            missing_skills=missing_skills,
            recommendation=recommendation
        )

    def GetRoleRequirements(self, request, context):
        required_skills = ROLE_REQUIREMENTS.get(
            request.role_name
        )

        if required_skills is None:
            context.set_code(grpc.StatusCode.NOT_FOUND)
            context.set_details(
                f"The role '{request.role_name}' does not exist."
            )
            return resume_analyzer_pb2.RoleResponse()

        print(
            f"Role requirements requested for: "
            f"{request.role_name}"
        )

        return resume_analyzer_pb2.RoleResponse(
            role_name=request.role_name,
            required_skills=required_skills
        )


def start_server():
    server = grpc.server(
        futures.ThreadPoolExecutor(max_workers=10)
    )

    resume_analyzer_pb2_grpc.add_ResumeAnalyzerServiceServicer_to_server(
        ResumeAnalyzerService(),
        server
    )

    server.add_insecure_port("[::]:50051")
    server.start()

    print("Resume Analyzer gRPC Server started")
    print("Server is running on localhost:50051")
    print("Press Ctrl+C to stop the server")

    try:
        server.wait_for_termination()
    except KeyboardInterrupt:
        print("\nStopping gRPC server...")
        server.stop(0)


if __name__ == "__main__":
    start_server()