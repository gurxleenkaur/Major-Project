
import { useEffect, useRef, useState } from "react";
import "./BookRecommendations.css";

const API = "http://127.0.0.1:5000";
const FAVORITES_KEY = "studyspark-book-favorites";

interface Book {
  id: string;
  title: string;
  authors: string[];
  description: string;
  thumbnail: string;
  publishedDate: string;
  categories: string[];
  averageRating?: number;
  previewLink: string;
  infoLink: string;
}

const FALLBACK_BOOKS: Book[] = [
  {
    id: "fallback-hands-on-ml",
    title: "Hands-On Machine Learning",
    authors: ["Aurélien Géron"],
    description:
      "A practical introduction to machine learning, neural networks, and building intelligent applications with Python.",
    thumbnail: "",
    publishedDate: "2022",
    categories: ["Machine Learning", "Technology"],
    previewLink: "",
    infoLink: "https://books.google.com/books?q=Hands-On+Machine+Learning",
  },
  {
    id: "fallback-python-crash-course",
    title: "Python Crash Course",
    authors: ["Eric Matthes"],
    description:
      "A beginner-friendly guide to Python programming with practical projects and hands-on exercises.",
    thumbnail: "",
    publishedDate: "2023",
    categories: ["Python", "Programming"],
    previewLink: "",
    infoLink: "https://books.google.com/books?q=Python+Crash+Course",
  },
  {
    id: "fallback-data-science",
    title: "Data Science from Scratch",
    authors: ["Joel Grus"],
    description:
      "Learn the foundations of data science, including statistics, machine learning, and data visualization.",
    thumbnail: "",
    publishedDate: "2019",
    categories: ["Data Science", "Machine Learning"],
    previewLink: "",
    infoLink: "https://books.google.com/books?q=Data+Science+from+Scratch",
  },
  {
    id: "fallback-atomic-habits",
    title: "Atomic Habits",
    authors: ["James Clear"],
    description:
      "Discover practical strategies for building better habits, improving consistency, and making small changes that compound over time.",
    thumbnail: "",
    publishedDate: "2018",
    categories: ["Productivity", "Personal Growth"],
    previewLink: "",
    infoLink: "https://books.google.com/books?q=Atomic+Habits",
  },
  {
    id: "fallback-deep-work",
    title: "Deep Work",
    authors: ["Cal Newport"],
    description:
      "Learn how to improve concentration, reduce distractions, and focus on demanding tasks in a distracted world.",
    thumbnail: "",
    publishedDate: "2016",
    categories: ["Productivity", "Study Skills"],
    previewLink: "",
    infoLink: "https://books.google.com/books?q=Deep+Work+Cal+Newport",
  },
  {
    id: "fallback-thinking-fast",
    title: "Thinking, Fast and Slow",
    authors: ["Daniel Kahneman"],
    description:
      "Explore two systems of thought and understand how human judgment, decisions, and cognitive biases work.",
    thumbnail: "",
    publishedDate: "2011",
    categories: ["Psychology", "Personal Growth"],
    previewLink: "",
    infoLink: "https://books.google.com/books?q=Thinking+Fast+and+Slow",
  },
  {
    id: "fallback-psychology-money",
    title: "The Psychology of Money",
    authors: ["Morgan Housel"],
    description:
      "Explore how emotions, behavior, and personal experiences influence financial decisions and long-term success.",
    thumbnail: "",
    publishedDate: "2020",
    categories: ["Psychology", "Personal Growth"],
    previewLink: "",
    infoLink: "https://books.google.com/books?q=The+Psychology+of+Money",
  },
  {
    id: "fallback-pragmatic-programmer",
    title: "The Pragmatic Programmer",
    authors: ["David Thomas", "Andrew Hunt"],
    description:
      "Develop practical problem-solving habits and learn principles for writing maintainable, reliable software.",
    thumbnail: "",
    publishedDate: "2019",
    categories: ["Programming", "Technology"],
    previewLink: "",
    infoLink: "https://books.google.com/books?q=The+Pragmatic+Programmer",
  },
  {
    id: "fallback-clean-code",
    title: "Clean Code",
    authors: ["Robert C. Martin"],
    description:
      "Learn principles and techniques for making software easier to understand, maintain, and improve.",
    thumbnail: "",
    publishedDate: "2008",
    categories: ["Programming", "Technology"],
    previewLink: "",
    infoLink: "https://books.google.com/books?q=Clean+Code+Robert+Martin",
  },
  {
    id: "fallback-game-of-thrones",
    title: "A Game of Thrones",
    authors: ["George R. R. Martin"],
    description:
      "The first novel in A Song of Ice and Fire, featuring political intrigue, rival families, and an expansive fantasy world.",
    thumbnail: "",
    publishedDate: "1996",
    categories: ["Fantasy", "Fiction"],
    previewLink: "",
    infoLink: "https://books.google.com/books?q=A+Game+of+Thrones",
  },
  {
    id: "fallback-ai-modern-approach",
    title: "Artificial Intelligence: A Modern Approach",
    authors: ["Stuart Russell", "Peter Norvig"],
    description:
      "A comprehensive introduction to artificial intelligence, including search, reasoning, learning, and intelligent agents.",
    thumbnail: "",
    publishedDate: "2021",
    categories: ["Artificial Intelligence", "Machine Learning"],
    previewLink: "",
    infoLink:
      "https://books.google.com/books?q=Artificial+Intelligence+A+Modern+Approach",
  },
  {
    id: "fallback-study-skills",
    title: "Make It Stick",
    authors: ["Peter C. Brown", "Henry L. Roediger III", "Mark A. McDaniel"],
    description:
      "Explore research-backed learning techniques, including retrieval practice and spaced learning, to make knowledge last.",
    thumbnail: "",
    publishedDate: "2014",
    categories: ["Study Skills", "Psychology"],
    previewLink: "",
    infoLink: "https://books.google.com/books?q=Make+It+Stick",
  },
];

function getFallbackBooks(searchTerm: string): Book[] {
  const term = searchTerm.trim().toLowerCase();

  if (!term) {
    return FALLBACK_BOOKS;
  }

  const words = term.split(/\s+/).filter(Boolean);

  const matches = FALLBACK_BOOKS.filter((book) => {
    const searchableText = [
      book.title,
      ...book.authors,
      book.description,
      ...book.categories,
    ]
      .join(" ")
      .toLowerCase();

    return words.some((word) => searchableText.includes(word));
  });

  // Keep the reading page useful even for topics outside the local catalogue.
  return matches.length > 0 ? matches : FALLBACK_BOOKS;
}

function readFavorites(): string[] {
  try {
    const saved = localStorage.getItem(FAVORITES_KEY);
    const parsed: unknown = JSON.parse(saved || "[]");

    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === "string")
      : [];
  } catch {
    return [];
  }
}

export default function BookRecommendations() {
  const [query, setQuery] = useState("");
  const [books, setBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [usingFallback, setUsingFallback] = useState(false);
  const [favorites, setFavorites] = useState<string[]>(readFavorites);

  const initialSearchStarted = useRef(false);
  const requestNumber = useRef(0);

  async function searchBooks(searchTerm = query) {
    const term = searchTerm.trim() || "study skills";
    const currentRequest = ++requestNumber.current;

    setLoading(true);
    setError("");
    setUsingFallback(false);

    try {
      const params = new URLSearchParams({
        q: term,
        maxResults: "24",
        orderBy: "relevance",
      });

      const response = await fetch(`${API}/api/books?${params}`, {
        headers: { Accept: "application/json" },
      });

      const data: {
        books?: Book[];
        detail?: string;
      } = await response.json();

      if (currentRequest !== requestNumber.current) {
        return;
      }

      if (!response.ok) {
        const fallback = getFallbackBooks(term);
        setBooks(fallback);
        setUsingFallback(true);

        if (response.status === 429) {
          setError(
            "Google Books is temporarily rate-limiting requests. Showing our reading collection instead."
          );
        } else {
          setError(
            data.detail ||
              "Live book search is temporarily unavailable. Showing our reading collection instead."
          );
        }

        return;
      }

      if (Array.isArray(data.books) && data.books.length > 0) {
        setBooks(data.books);
        setUsingFallback(false);
        setError("");
      } else {
        setBooks(getFallbackBooks(term));
        setUsingFallback(true);
        setError(
          data.detail ||
            "Live results are unavailable right now. Showing our curated reading collection instead."
        );
      }
    } catch {
      if (currentRequest !== requestNumber.current) {
        return;
      }

      setBooks(getFallbackBooks(term));
      setUsingFallback(true);
      setError(
        "Could not reach the live book service. Showing our curated reading collection instead."
      );
    } finally {
      if (currentRequest === requestNumber.current) {
        setLoading(false);
      }
    }
  }

  useEffect(() => {
    if (initialSearchStarted.current) {
      return;
    }

    initialSearchStarted.current = true;
    void searchBooks("study skills");

    // Run the initial search once when this component mounts.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function toggleFavorite(id: string) {
    setFavorites((previous) => {
      const updated = previous.includes(id)
        ? previous.filter((item) => item !== id)
        : [...previous, id];

      try {
        localStorage.setItem(FAVORITES_KEY, JSON.stringify(updated));
      } catch {
        // Favorites remain usable for the current session if storage is unavailable.
      }

      return updated;
    });
  }

  return (
    <section className="br-page">
      <header className="br-header">
        <span className="br-eyebrow">YOUR PERSONAL READING SPACE</span>
        <h1>
          Discover your next <span>great read.</span>
        </h1>
        <p>
          Explore books for learning, technology, productivity and personal
          growth.
        </p>
      </header>

      <form
        className="br-search"
        onSubmit={(event) => {
          event.preventDefault();
          void searchBooks();
        }}
      >
        <span aria-hidden="true">⌕</span>
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search Python, AI, productivity..."
          aria-label="Search books"
        />
        <button type="submit" disabled={loading}>
          {loading ? "Searching..." : "Find books"}
        </button>
      </form>

      <div className="br-topics">
        {[
          "Machine Learning",
          "Python",
          "Data Science",
          "Productivity",
          "Psychology",
        ].map((topic) => (
          <button
            key={topic}
            type="button"
            disabled={loading}
            onClick={() => {
              setQuery(topic);
              void searchBooks(topic);
            }}
          >
            {topic}
          </button>
        ))}
      </div>

      <div className="br-section-heading">
        <div>
          <h2>Books for your journey</h2>
          <p>
            {usingFallback
              ? "Curated reading recommendations"
              : "Handpicked search results from Google Books"}
          </p>
        </div>
        <span>
          {books.length} {books.length === 1 ? "book" : "books"}
        </span>
      </div>

      {error && (
        <div className="br-message" role="status">
          <p>{error}</p>
          {usingFallback && (
            <button
              type="button"
              onClick={() => void searchBooks()}
              disabled={loading}
            >
              Retry live search
            </button>
          )}
        </div>
      )}

      {loading ? (
        <div className="br-loading" role="status">
          Finding books for you...
        </div>
      ) : books.length === 0 ? (
        <div className="br-message">
          No books are available right now. Please try another search.
        </div>
      ) : (
        <div className="br-grid">
          {books.map((book) => (
            <article className="br-card" key={book.id}>
              <div className="br-cover">
                {book.thumbnail ? (
                  <img
                    src={book.thumbnail}
                    alt={`Cover of ${book.title}`}
                    loading="lazy"
                    onError={(event) => {
                      event.currentTarget.style.display = "none";
                    }}
                  />
                ) : (
                  <div className="br-no-cover">
                    <span>BOOK</span>
                    <span aria-hidden="true">✦</span>
                  </div>
                )}

                <button
                  type="button"
                  className={`br-favorite ${
                    favorites.includes(book.id) ? "is-favorite" : ""
                  }`}
                  onClick={() => toggleFavorite(book.id)}
                  aria-label={
                    favorites.includes(book.id)
                      ? "Remove from favorites"
                      : "Add to favorites"
                  }
                  title="Toggle favorite"
                >
                  {favorites.includes(book.id) ? "♥" : "♡"}
                </button>
              </div>

              <div className="br-card-content">
                <div className="br-categories">
                  {book.categories?.[0] || "Recommended reading"}
                </div>

                <h3>{book.title}</h3>

                <p className="br-author">
                  {book.authors?.join(", ") || "Author not listed"}
                </p>

                {book.averageRating != null && (
                  <p className="br-rating">
                    ★ {book.averageRating.toFixed(1)} / 5
                  </p>
                )}

                <p className="br-description">
                  {book.description || "Explore this title to learn more."}
                </p>

                <div className="br-card-actions">
                  <a
                    href={
                      book.previewLink ||
                      book.infoLink ||
                      `https://books.google.com/books?q=${encodeURIComponent(
                        book.title
                      )}`
                    }
                    target="_blank"
                    rel="noreferrer"
                  >
                    Explore book ↗
                  </a>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      <div className="br-favorites-note">
        ♥ {favorites.length} saved{" "}
        {favorites.length === 1 ? "book" : "books"}
        <span>Favorites are saved in this browser.</span>
      </div>
    </section>
  );
}
