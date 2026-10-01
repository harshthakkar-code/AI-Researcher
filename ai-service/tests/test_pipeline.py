import asyncio
from app.services.research import run_research_pipeline

async def main():
    print("Testing Autonomous Research Pipeline execution...")
    test_id = "test-job-001"
    topic = "Autonomous Multi-Agent Architectures in 2026"
    await run_research_pipeline(research_id=test_id, topic_override=topic)
    print("Pipeline test completed successfully!")

if __name__ == "__main__":
    asyncio.run(main())
