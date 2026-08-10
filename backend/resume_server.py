from concurrent import futures

import grpc

import resume_analyzer_pb2
import resume_analyzer_pb2_grpc

from lamport_clock import LamportClock


clock = LamportClock()


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

    def GetRoleRequirements(self, request, context):

        # Receive event
        receive_time = clock.receive_event(
            request.lamport_time
        )

        print("\n========== GET ROLE REQUIREMENTS ==========")
        print(
            f"Received Client Lamport Clock : "
            f"{request.lamport_time}"
        )
        print(
            f"Server Clock After Receive    : "
            f"{receive_time}"
        )

        required_skills = ROLE_REQUIREMENTS.get(
            request.role_name
        )

        if required_skills is None:
            context.set_code(
                grpc.StatusCode.NOT_FOUND
            )

            context.set_details(
                f"Role '{request.role_name}' not found."
            )

            return resume_analyzer_pb2.RoleResponse()

        print(
            f"Requested Role                : "
            f"{request.role_name}"
        )

        # Send event
        send_time = clock.send_event()

        print(
            f"Server Clock Before Response  : "
            f"{send_time}"
        )

        return resume_analyzer_pb2.RoleResponse(
            role_name=request.role_name,
            required_skills=required_skills,
            lamport_time=send_time
        )

    def AnalyzeCandidate(self, request, context):

        # Receive event
        receive_time = clock.receive_event(
            request.lamport_time
        )

        print("\n========== ANALYZE CANDIDATE ==========")

        print(
            f"Received Client Lamport Clock : "
            f"{request.lamport_time}"
        )

        print(
            f"Server Clock After Receive    : "
            f"{receive_time}"
        )

        target_role = request.target_role

        required_skills = ROLE_REQUIREMENTS.get(
            target_role
        )

        if required_skills is None:

            context.set_code(
                grpc.StatusCode.NOT_FOUND
            )

            context.set_details(
                f"Role '{target_role}' not found."
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
            len(matched_skills)
            / len(required_skills)
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

        print(f"Candidate Name : {request.candidate_name}")
        print(f"Target Role    : {request.target_role}")
        print(f"Score          : {final_score}%")

        # Send event
        send_time = clock.send_event()

        print(
            f"Server Clock Before Response  : "
            f"{send_time}"
        )

        return resume_analyzer_pb2.CandidateResponse(
            candidate_name=request.candidate_name,
            email=request.email,
            target_role=request.target_role,
            score=final_score,
            matched_skills=matched_skills,
            missing_skills=missing_skills,
            recommendation=recommendation,
            lamport_time=send_time
        )


def start_server():

    server = grpc.server(
        futures.ThreadPoolExecutor(
            max_workers=10
        )
    )

    resume_analyzer_pb2_grpc \
        .add_ResumeAnalyzerServiceServicer_to_server(
            ResumeAnalyzerService(),
            server
        )

    server.add_insecure_port(
        "[::]:50051"
    )

    server.start()

    print(
        "Resume Analyzer gRPC Server "
        "started on port 50051"
    )

    print(
        "Lamport Logical Clock enabled"
    )

    server.wait_for_termination()


if __name__ == "__main__":
    start_server()