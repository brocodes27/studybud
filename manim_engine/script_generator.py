import os
import sys
from openai import OpenAI

# Initialize OpenAI client
client = OpenAI(api_key=os.getenv("OPENAI_API_KEY") or os.getenv("VITE_OPENAI_API_KEY"))

def generate_educational_script(topic):
    """
    Generates a concise, visually descriptive educational script for a given topic.
    """
    prompt = (
        f"Write a comprehensive, deep-dive educational script explaining '{topic}'. "
        "The script MUST be suitable for a 3-6 minute visual animation (approx. 500-700 words)."
        "Structure the content into 3-8 distinct conceptual blocks (e.g., Introduction, Core Mechanism, Visual Examples, Conclusion). "
        "Focus heavily on physical comparisons, movement, and visualizable structures. "
        "Do not include 'In this video' or 'Welcome'. Dive straight into the core concepts."
    )

    try:
        response = client.chat.completions.create(
            model="gpt-4o",
            messages=[
                {"role": "system", "content": "You are a science communicator like 3Blue1Brown."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.7,
            max_tokens=1000
        )
        return response.choices[0].message.content.strip()
    except Exception as e:
        print(f"Error generating script: {e}", file=sys.stderr)
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
