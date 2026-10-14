import os
import sys
from meta_client import generate_text
from dotenv import load_dotenv
load_dotenv()

def generate_educational_script(topic):
    """
    Generates a concise, visually descriptive educational script for a given topic.
    """
    if not os.getenv("MODEL_API_KEY"):
        print("Error: MODEL_API_KEY not configured", file=sys.stderr)
        return None

    prompt = (
        f"You are a science communicator like 3Blue1Brown. "
        f"Write a comprehensive, deep-dive educational script explaining '{topic}'. "
        "The script MUST be suitable for a 3-6 minute visual animation (approx. 500-700 words). "
        "Structure the content into 3-8 distinct conceptual blocks (e.g., Introduction, Core Mechanism, Visual Examples, Conclusion). "
        "Focus heavily on physical comparisons, movement, and visualizable structures. "
        "Do not include 'In this video' or 'Welcome'. Dive straight into the core concepts."
    )

    try:
        return generate_text(prompt, max_tokens=4096)
    except Exception as e:
        print(f"Error generating script with Meta: {e}", file=sys.stderr)
        return None

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python script_generator.py <topic>")
        sys.exit(1)

    topic = sys.argv[1]
    script = generate_educational_script(topic)
    
    if script:
        print(script)
    else:
        sys.exit(1)
