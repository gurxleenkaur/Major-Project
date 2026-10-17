from productivity_routes import productivity_bp
from auth_routes import auth_bp
import json
import os
import re
from io import BytesIO
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen

from dotenv import load_dotenv
from flask import Flask, jsonify, request as flask_request
from flask_cors import CORS
from pypdf import PdfReader

# Active AI provider: Groq
from groq import Groq

# Previous AI provider: Gemini
# Uncomment this import when switching back to Gemini.
# from google import genai


load_dotenv(override=True)


# ==========================================
# GROQ CONFIGURATION (CURRENTLY ACTIVE)
# ==========================================

groq_api_key = os.getenv("GROQ_API_KEY")
client = Groq(api_key=groq_api_key) if groq_api_key else None


# ==========================================
# GEMINI CONFIGURATION (BACKUP)
# ==========================================

# gemini_api_key = os.getenv("GEMINI_API_KEY")
# gemini_client = (
#     genai.Client(api_key=gemini_api_key)
#     if gemini_api_key
#     else None
# )


# ==========================================
# INITIALIZE FLASK
# ==========================================

app = Flask(__name__)
# Allow the local Vite frontend to call the API.
CORS(
    app,
    resources={r"/api/*": {"origins": [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ]}},
    supports_credentials=True,
)

# Register the Productivity Predictor API.

app.register_blueprint(productivity_bp)
app.register_blueprint(auth_bp)
# Leave room for multipart form overhead; enforce the 10 MB PDF limit
# against the uploaded file itself in the upload route below.
app.config["MAX_CONTENT_LENGTH"] = 11 * 1024 * 1024


class HTTPException(Exception):
    """Small compatibility exception that preserves FastAPI-style error JSON."""

    def __init__(self, status_code, detail):
        super().__init__(detail)
        self.status_code = status_code
        self.detail = detail


@app.errorhandler(HTTPException)
def handle_api_error(error):
    return jsonify({"detail": error.detail}), error.status_code


@app.errorhandler(413)
def handle_request_too_large(_error):
    return jsonify({"detail": "PDF size must not exceed 10 MB."}), 413


class StudyRequest:
    """Validated equivalent of the original Pydantic request model."""

    def __init__(self, topic="", content="", action=None, question_count=10, difficulty="Mixed"):
        self.topic = topic
        self.content = content
        self.action = action
        self.question_count = question_count
        self.difficulty = difficulty


def parse_study_request(payload):
    if not isinstance(payload, dict):
        raise HTTPException(400, "Request body must be a JSON object.")

    topic = payload.get("topic", "")
    content = payload.get("content", "")
    action = payload.get("action")
    difficulty = payload.get("difficulty", "Mixed")
    question_count = payload.get("question_count", 10)

    errors = []
    for field, value in (("topic", topic), ("content", content), ("action", action), ("difficulty", difficulty)):
        if value is not None and not isinstance(value, str):
            errors.append({"loc": ["body", field], "msg": "Input should be a valid string", "type": "string_type"})
    if action is None:
        errors.append({"loc": ["body", "action"], "msg": "Field required", "type": "missing"})
    if isinstance(question_count, bool) or not isinstance(question_count, int):
        errors.append({"loc": ["body", "question_count"], "msg": "Input should be a valid integer", "type": "int_type"})
    elif not 5 <= question_count <= 20:
        errors.append({"loc": ["body", "question_count"], "msg": "Input should be greater than or equal to 5 and less than or equal to 20", "type": "less_than_equal" if question_count > 20 else "greater_than_equal"})
    if errors:
        raise HTTPException(422, errors)
    return StudyRequest(topic=topic or "", content=content or "", action=action, question_count=question_count, difficulty=difficulty or "Mixed")


# ==========================================
# HOME ENDPOINT
# ==========================================

@app.get("/")
def home():
    return {"message": "StudySpark API is running!"}


# ==========================================
# GENERATE STUDY MATERIAL
# ==========================================

@app.post("/api/study")
def generate_study_material():
    request_data = flask_request.get_json(silent=True)
    study_request = parse_study_request(request_data)
    request = study_request

    if not request.topic.strip() and not request.content.strip():
        raise HTTPException(
            status_code=400,
            detail="Please provide a topic or study material.",
        )

    if client is None:
        raise HTTPException(
            status_code=503,
            detail=(
                "Groq API key is missing. "
                "Add GROQ_API_KEY to backend/.env."
            ),
        )

    allowed_actions = {
        "summary",
        "quiz",
        "flashcards",
        "weak_topics",
    }

    if request.action not in allowed_actions:
        raise HTTPException(
            status_code=400,
            detail=(
                "Invalid action. Choose summary, quiz, "
                "flashcards, or weak_topics."
            ),
        )

    if request.action == "quiz":

        if request.question_count not in (5, 10, 15, 20):
            raise HTTPException(
                status_code=400,
                detail="Question count must be 5, 10, 15, or 20.",
            )

        if request.difficulty not in (
            "Easy",
            "Medium",
            "Hard",
            "Mixed",
        ):
            raise HTTPException(
                status_code=400,
                detail=(
                    "Difficulty must be Easy, Medium, Hard, or Mixed."
                ),
            )

    source = (
        request.content.strip()
        or request.topic.strip()
    )[:30000]

    # ==========================================
    # BUILD PROMPT FOR THE SELECTED ACTION
    # ==========================================

    if request.action == "summary":

        prompt = f"""
Create clear, accurate study notes on the following material.

Requirements:
- Start with a suitable title.
- Use meaningful headings and subheadings.
- Explain important concepts in simple language.
- Include definitions, key points, and examples where useful.
- Use bullet points for revision.
- Do not invent facts that are not supported by the material.
- Make the notes useful for college examinations.

Mathematical formatting rules:
- Write inline mathematical expressions using $...$ delimiters.
- Write standalone equations using $$...$$ delimiters.
- Use valid LaTeX syntax inside these delimiters.
- Never write raw LaTeX commands such as \\frac, \\sqrt, or \\sum outside math delimiters.
- For example, represent the logistic sigmoid function as $\\sigma(z) = \\frac{{1}}{{1 + e^{{-z}}}}$.
- For a standalone equation, put the equation between $$ delimiters.
- Use normal text for concepts that do not require mathematical notation.
- Keep the remaining content in Markdown format.
- Do not wrap the entire response in a code block.

Study material:

{source}
"""

    elif request.action == "flashcards":

        prompt = f"""
Create exactly 10 useful study flashcards from the material below.

Return ONLY valid JSON. Do not include Markdown fences or extra text.

Use exactly this structure:
{{
  "cards": [
    {{
      "question": "A clear question or concept",
      "answer": "A concise, accurate answer"
    }}
  ]
}}

Rules:
- Generate exactly 10 cards.
- Each card must have a non-empty question and answer.
- Cover important concepts from the supplied material.
- Avoid duplicate cards.
- Keep answers clear and useful for revision.
- Return valid JSON only.

Study material:
{source}
"""

    elif request.action == "weak_topics":

        prompt = f"""
Analyze the following study material and identify topics a student
should prioritize for revision.

For each topic, provide:
- Topic name
- Why it is important or potentially difficult
- Concepts to revise
- One practical revision suggestion

Do not claim to know the student's actual weaknesses without
performance data. Present these as potential areas to review.

Study material:
{source}
"""

    else:

        prompt = f"""
Create exactly {request.question_count} multiple-choice questions
from the study material below.

Difficulty: {request.difficulty}

Return ONLY valid JSON, with no Markdown fences or extra text.

Use exactly this structure:

{{
  "questions": [
    {{
      "question": "Question text",
      "options": [
        {{"id": "A", "text": "Option A"}},
        {{"id": "B", "text": "Option B"}},
        {{"id": "C", "text": "Option C"}},
        {{"id": "D", "text": "Option D"}}
      ],
      "correct_answer": "A",
      "explanation": "Explain why the answer is correct."
    }}
  ]
}}

Rules:
- Generate exactly {request.question_count} questions.
- Each question must have exactly four options: A, B, C, and D.
- correct_answer must be one of A, B, C, or D.
- Only one option should be correct.
- Questions must be based on the supplied material.
- Avoid duplicate questions.
- Ensure the JSON is valid.

Study material:
{source}
"""

    # ==========================================
    # AI GENERATION
    # GROQ IS ACTIVE; GEMINI IS KEPT AS BACKUP
    # ==========================================

    try:

        # --------------------------------------
        # GROQ API CALL (CURRENTLY ACTIVE)
        # --------------------------------------

        response = client.chat.completions.create(
            model="openai/gpt-oss-20b",
            messages=[
                {
                    "role": "system",
                    "content": (
                        "You are StudySpark, a helpful and accurate "
                        "study assistant. Follow the requested output "
                        "format exactly. For mathematical content in "
                        "Markdown responses, use $...$ for inline "
                        "math and $$...$$ for display equations. "
                        "Never leave raw LaTeX commands outside "
                        "math delimiters."
                    ),
                },
                {
                    "role": "user",
                    "content": prompt,
                },
            ],
            temperature=0.3,
            max_completion_tokens=6000,
        )

        result = response.choices[0].message.content or ""

        # --------------------------------------
        # GEMINI API CALL (BACKUP - COMMENTED)
        # --------------------------------------
        #
        # To switch back to Gemini:
        # 1. Uncomment the Gemini import and configuration above.
        # 2. Comment out the Groq API call above.
        # 3. Uncomment the following Gemini call.
        # 4. Change the missing-key check to use gemini_client.
        #
        # response = gemini_client.models.generate_content(
        #     model="gemini-3.5-flash-lite",
        #     contents=prompt,
        # )
        #
        # result = response.text or ""

        # Check for an empty AI response
        if not result.strip():
            raise HTTPException(
                status_code=502,
                detail=(
                    "The AI returned an empty response. "
                    "Please try again."
                ),
            )

        # ==========================================
        # VALIDATE GENERATED QUIZZES
        # ==========================================

        if request.action == "quiz":

            cleaned = re.sub(
                r"^```(?:json)?\s*|\s*```$",
                "",
                result.strip(),
                flags=re.IGNORECASE,
            ).strip()

            try:
                quiz = json.loads(cleaned)
                questions = quiz["questions"]

                if len(questions) != request.question_count:
                    raise ValueError(
                        "Incorrect number of questions."
                    )

                for question in questions:

                    required_keys = {
                        "question",
                        "options",
                        "correct_answer",
                        "explanation",
                    }

                    if not required_keys.issubset(question):
                        raise ValueError(
                            "A question is missing required fields."
                        )

                    if len(question["options"]) != 4:
                        raise ValueError(
                            "Each question must have four options."
                        )

                    option_ids = {
                        option["id"]
                        for option in question["options"]
                    }

                    if option_ids != {"A", "B", "C", "D"}:
                        raise ValueError("Invalid option IDs.")

                    if question["correct_answer"] not in option_ids:
                        raise ValueError("Invalid correct answer.")

                    if not all(
                        isinstance(option.get("text"), str)
                        for option in question["options"]
                    ):
                        raise ValueError("Invalid option text.")

            except (
                json.JSONDecodeError,
                KeyError,
                TypeError,
                ValueError,
            ):
                raise HTTPException(
                    status_code=502,
                    detail=(
                        "The AI generated an invalid quiz. "
                        "Please try again."
                    ),
                )

            return {
                "action": "quiz",
                "quiz": quiz,
            }

        # ==========================================
        # VALIDATE GENERATED FLASHCARDS
        # ==========================================

        if request.action == "flashcards":

            cleaned = re.sub(
                r"^```(?:json)?\s*|\s*```$",
                "",
                result.strip(),
                flags=re.IGNORECASE,
            ).strip()

            try:
                flashcards = json.loads(cleaned)
                cards = flashcards["cards"]

                if len(cards) != 10:
                    raise ValueError(
                        "Incorrect number of flashcards."
                    )

                for card in cards:

                    if not isinstance(card.get("question"), str):
                        raise ValueError(
                            "Invalid flashcard question."
                        )

                    if not isinstance(card.get("answer"), str):
                        raise ValueError(
                            "Invalid flashcard answer."
                        )

                    if (
                        not card["question"].strip()
                        or not card["answer"].strip()
                    ):
                        raise ValueError(
                            "Flashcard fields cannot be empty."
                        )

            except (
                json.JSONDecodeError,
                KeyError,
                TypeError,
                ValueError,
            ):
                raise HTTPException(
                    status_code=502,
                    detail=(
                        "The AI generated invalid flashcards. "
                        "Please try again."
                    ),
                )

            # Convert the generated cards into Markdown
            # for the existing frontend.
            formatted_result = "\n\n".join(
                (
                    f"### Flashcard {index}\n\n"
                    f"**Question:** {card['question']}\n\n"
                    f"**Answer:** {card['answer']}"
                )
                for index, card in enumerate(cards, start=1)
            )

            return {
                "action": "flashcards",
                "result": formatted_result,
                "flashcards": flashcards,
            }

        # Return summaries and weak-topic analysis
        return {
            "action": request.action,
            "result": result,
        }

    except HTTPException:
        raise

    except Exception as e:
        print("AI API error:", repr(e))

        raise HTTPException(
            status_code=502,
            detail=(
                "AI generation failed. Check the backend terminal "
                "for details and verify your API key and model."
            ),
        )


# ==========================================
# UPLOAD AND EXTRACT TEXT FROM A PDF
# ==========================================

@app.post("/api/upload-pdf")
def upload_pdf():
    file = flask_request.files.get("file")

    if (
        file is None
        or not file.filename
        or not file.filename.lower().endswith(".pdf")
    ):
        raise HTTPException(
            status_code=400,
            detail="Please upload a PDF file.",
        )

    try:
        pdf_bytes = file.read()

        if not pdf_bytes:
            raise HTTPException(
                status_code=400,
                detail="The uploaded PDF is empty.",
            )

        if len(pdf_bytes) > 10 * 1024 * 1024:
            raise HTTPException(
                status_code=413,
                detail="PDF size must not exceed 10 MB.",
            )

        reader = PdfReader(BytesIO(pdf_bytes))

        extracted_text = "\n".join(
            page.extract_text() or ""
            for page in reader.pages
        ).strip()

        if not extracted_text:
            raise HTTPException(
                status_code=400,
                detail=(
                    "No selectable text was found in this PDF. "
                    "Scanned PDFs currently require OCR."
                ),
            )

        return {
            "filename": file.filename,
            "text": extracted_text[:30000],
        }

    except HTTPException:
        raise

    except Exception as e:
        print("PDF processing error:", repr(e))

        raise HTTPException(
            status_code=400,
            detail="Could not read the PDF. Please check the file.",
        )

    finally:
        if file is not None:
            file.close()


# ==========================================
# GOOGLE BOOKS API — BOOK RECOMMENDATIONS
# ==========================================

@app.get("/api/books")
def get_books():
    # Read and validate search parameters.
    query = flask_request.args.get("q", "").strip()
    subject = flask_request.args.get("subject", "").strip()
    order_by = flask_request.args.get("orderBy", "relevance").strip()

    try:
        max_results = int(flask_request.args.get("maxResults", 24))
    except (TypeError, ValueError):
        max_results = 24

    max_results = max(1, min(max_results, 40))

    if order_by not in ("relevance", "newest"):
        order_by = "relevance"

    # Google Books requires a search query.
    search_query = query or (
        f"subject:{subject}" if subject else "study skills"
    )

    params = {
        "q": search_query[:200],
        "maxResults": max_results,
        "orderBy": order_by,
        "printType": "books",
    }

    # An API key is optional for basic usage.
    google_books_key = os.getenv("GOOGLE_BOOKS_API_KEY")
    if google_books_key:
        params["key"] = google_books_key

    url = (
        "https://www.googleapis.com/books/v1/volumes?"
        + urlencode(params)
    )

    api_request = Request(
        url,
        headers={"User-Agent": "StudySpark-AI/1.0"},
    )

    try:
        with urlopen(api_request, timeout=12) as response:
            google_data = json.loads(response.read().decode("utf-8"))

        books = []

        for item in google_data.get("items", []):
            volume = item.get("volumeInfo", {})
            image_links = volume.get("imageLinks", {})

            thumbnail = (
                image_links.get("thumbnail")
                or image_links.get("smallThumbnail")
                or ""
            )

            # Prefer HTTPS for book-cover images.
            if thumbnail.startswith("http://"):
                thumbnail = "https://" + thumbnail[len("http://"):]

            description = re.sub(
                r"<[^>]+>", " ", volume.get("description", "")
            )
            description = re.sub(r"\s+", " ", description).strip()

            books.append({
                "id": item.get("id", ""),
                "title": volume.get("title", "Untitled"),
                "authors": volume.get("authors", []),
                "description": description,
                "thumbnail": thumbnail,
                "publishedDate": volume.get("publishedDate", ""),
                "categories": volume.get("categories", []),
                "averageRating": volume.get("averageRating"),
                "previewLink": volume.get("previewLink", ""),
                "infoLink": volume.get("infoLink", ""),
            })

        return jsonify({
            "totalItems": google_data.get("totalItems", 0),
            "books": books,
        })

    
    except HTTPError as error:
        error_body = error.read().decode("utf-8", errors="replace")

        print("Google Books HTTP error:", error.code)
        print("Google Books error details:", error_body)

        if error.code == 429:
            return jsonify({
                "detail": "Google Books is temporarily rate-limiting requests. Please try again later.",
                "books": []
            }), 200

        return jsonify({
            "detail": "Google Books could not complete the search.",
            "books": []
        }), 200


    except (URLError, TimeoutError) as error:
        print("Google Books connection error:", repr(error))
        return jsonify({
            "detail": "Could not connect to Google Books. Please try again."
        }), 502

    except (json.JSONDecodeError, UnicodeDecodeError) as error:
        print("Google Books response error:", repr(error))
        return jsonify({
            "detail": "Google Books returned an invalid response."
        }), 502


# ==========================================
# START FLASK SERVER
# ==========================================

if __name__ == "__main__":
    app.run(
        host="127.0.0.1",
        port=5000,
        debug=True,
    )