import os
import sys
import google.generativeai as genai
from dotenv import load_dotenv
load_dotenv()

# Initialize Gemini
api_key = os.getenv("GEMINI_API_KEY") or os.getenv("VITE_GEMINI_API_KEY")
if api_key:
    genai.configure(api_key=api_key)
    model = genai.GenerativeModel('gemini-3-flash-preview')
else:
    model = None

def generate_educational_script(topic):
    """
    Generates a concise, visually descriptive educational script for a given topic.
    """
    if not model:
        print("Error: Gemini API key not found", file=sys.stderr)
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
        response = model.generate_content(
            prompt,
            generation_config=genai.types.GenerationConfig(
                temperature=0.7,
                max_output_tokens=2048
            )
        )
        return response.text.strip()
    except Exception as e:
        print(f"Error generating script with Gemini: {e}", file=sys.stderr)
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
