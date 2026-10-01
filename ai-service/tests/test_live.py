import asyncio
import uuid
from app.services.research import run_research_pipeline
from app.services.supabase import get_supabase_client

async def test_live():
    client = get_supabase_client()
    topic = "Upcoming concert in ahmedabad with date and venue"

    # Insert a real test job into Supabase
    if client:
        res = client.table("research_jobs").insert({"topic": topic, "status": "pending", "progress": 0}).execute()
        job_id = res.data[0]["id"]
        print(f"Created real Supabase test job ID: {job_id}")
        await run_research_pipeline(research_id=job_id, topic_override=topic)

        # Fetch generated report
        report_res = client.table("reports").select("*").eq("research_id", job_id).execute()
        if report_res.data:
            print("\n=== GENERATED REPORT PREVIEW ===\n")
            print(report_res.data[0]["content_markdown"][:1000])
        else:
            print("No report row found.")
    else:
        print("Offline mode.")

if __name__ == "__main__":
    asyncio.run(test_live())
