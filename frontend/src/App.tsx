
import { Fragment } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'
import 'katex/dist/katex.min.css'
import { useEffect, useRef, useState } from 'react'
import './App.css'

type Tab =
  | 'Overview'
  | 'Study Materials'
  | 'Quizzes'
  | 'Flashcards'
  | 'Recommendations'

type StudyAction = 'summary' | 'quiz' | 'flashcards' | 'weak_topics'

type QuizOption = {
  id: string
  text: string
}

type QuizQuestion = {
  question: string
  options: QuizOption[]
  correct_answer: string
  explanation: string
}

type FlashcardItem = {
  question: string
  answer: string
}

type StudyResponse = {
  result?: string
  quiz?: { questions: QuizQuestion[] }
  flashcards?: { cards: FlashcardItem[] } | FlashcardItem[]
  detail?: string
}

const API = 'http://127.0.0.1:5000'

/* Inline SVG icons: no icon library required. */
function Icon({
  name,
  size = 20,
}: {
  name: string
  size?: number
}) {
  const paths: Record<string, React.ReactNode> = {
    home: (
      <>
        <path d="m3 10 9-7 9 7" />
        <path d="M5 9v11h14V9" />
        <path d="M9 20v-7h6v7" />
      </>
    ),
    book: (
      <>
        <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
        <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2Z" />
        <path d="M8 7h8M8 11h8" />
      </>
    ),
    brain: (
      <>
        <path d="M12 18V5" />
        <path d="M15.5 4.5a3.5 3.5 0 0 1 3 5.3A4 4 0 0 1 17 17H12" />
        <path d="M8.5 4.5a3.5 3.5 0 0 0-3 5.3A4 4 0 0 0 7 17h5" />
        <path d="M8 8a3 3 0 0 1 0 6M16 8a3 3 0 0 0 0 6" />
      </>
    ),
    cards: (
      <>
        <rect x="3" y="4" width="14" height="16" rx="2" />
        <path d="M7 8h6M7 12h6" />
        <path d="M17 8h3a1 1 0 0 1 1 1v11H9" />
      </>
    ),
    target: (
      <>
        <circle cx="12" cy="12" r="9" />
        <circle cx="12" cy="12" r="5" />
        <circle cx="12" cy="12" r="1" />
      </>
    ),
    file: (
      <>
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" />
        <path d="M14 2v6h6M8 13h8M8 17h8" />
      </>
    ),
    search: (
      <>
        <circle cx="11" cy="11" r="7" />
        <path d="m16 16 4 4" />
      </>
    ),
    upload: (
      <>
        <path d="M12 16V4m-5 5 5-5 5 5" />
        <path d="M4 16v4h16v-4" />
      </>
    ),
    sparkles: (
      <>
        <path d="m12 3 1.9 5.8L20 11l-6.1 2.2L12 19l-1.9-5.8L4 11l6.1-2.2L12 3Z" />
        <path d="m19 14 1 2.5 2 1-2 1-1 2.5-1-2.5-2-1 2-1 1-2.5Z" />
      </>
    ),
    arrow: (
      <>
        <path d="M5 12h14" />
        <path d="m13 6 6 6-6 6" />
      </>
    ),
    sun: (
      <>
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2M12 20v2M4.93 4.93l1.42 1.42m11.3 11.3 1.42 1.42M2 12h2m16 0h2M4.93 19.07l1.42-1.42m11.3-11.3 1.42-1.42" />
      </>
    ),
    moon: (
      <path d="M20.9 13A9 9 0 0 1 11 3.1 9 9 0 1 0 20.9 13Z" />
    ),
    copy: (
      <>
        <rect x="8" y="8" width="12" height="12" rx="2" />
        <path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3" />
      </>
    ),
    shuffle: (
      <>
        <path d="m18 14 4 4-4 4" />
        <path d="M2 18h2.5a6 6 0 0 0 4.8-2.4l5.4-7.2A6 6 0 0 1 19.5 6H22" />
        <path d="m18 2 4 4-4 4" />
        <path d="M2 6h2.5a6 6 0 0 1 3.4 1.1M14 16.9a6 6 0 0 0 5.5 3.1H22" />
      </>
    ),
    check: <path d="m5 12 4 4L19 6" />,
    lightbulb: (
      <>
        <path d="M9 18h6m-5 4h4" />
        <path d="M8 14a7 7 0 1 1 8 0c-1 1-1 2-1 4h-6c0-2 0-3-1-4Z" />
      </>
    ),
  }

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name] ?? paths.sparkles}
    </svg>
  )
}

function renderTextWithBreaks(
  children: React.ReactNode,
): React.ReactNode {
  if (typeof children === 'string') {
    const parts = children.split(/<br\s*\/?>|&lt;br\s*\/?&gt;/gi)

    return parts.map((part, index) => (
      <Fragment key={index}>
        {index > 0 && <br />}
        {part}
      </Fragment>
    ))
  }

  if (Array.isArray(children)) {
    return children.map((child, index) => (
      <Fragment key={index}>
        {renderTextWithBreaks(child)}
      </Fragment>
    ))
  }

  return children
}

function App() {
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    try {
      return localStorage.getItem('studyspark-theme') === 'dark'
        ? 'dark'
        : 'light'
    } catch {
      return 'light'
    }
  })

  useEffect(() => {
    try {
      localStorage.setItem('studyspark-theme', theme)
    } catch {
      // The app still works if browser storage is unavailable.
    }
  }, [theme])

  const [activeTab, setActiveTab] = useState<Tab>('Overview')
  const [topic, setTopic] = useState('')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [studyContent, setStudyContent] = useState('')
  const [loadedFileName, setLoadedFileName] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const [dragging, setDragging] = useState(false)

  const [generatedResults, setGeneratedResults] = useState<
    Record<StudyAction, string>
  >({
    summary: '',
    quiz: '',
    flashcards: '',
    weak_topics: '',
  })

  const [questionCount, setQuestionCount] = useState('10')
  const [difficulty, setDifficulty] = useState('Mixed')
  const [quizQuestions, setQuizQuestions] = useState<QuizQuestion[]>([])
  const [quizAnswers, setQuizAnswers] = useState<Record<number, string>>({})
  const [quizSubmitted, setQuizSubmitted] = useState(false)

  const [generatedFlashcards, setGeneratedFlashcards] = useState<
    FlashcardItem[]
  >([])
  const [currentFlashcard, setCurrentFlashcard] = useState(0)
  const [showAnswer, setShowAnswer] = useState(false)
  const [flashcardStatus, setFlashcardStatus] = useState<
    Record<number, 'known' | 'review'>
  >({})

  const fileInput = useRef<HTMLInputElement>(null)

  const tabs: { name: Tab; icon: string }[] = [
    { name: 'Overview', icon: 'home' },
    { name: 'Study Materials', icon: 'book' },
    { name: 'Quizzes', icon: 'brain' },
    { name: 'Flashcards', icon: 'cards' },
    { name: 'Recommendations', icon: 'target' },
  ]

  const quizScore = quizQuestions.filter(
    (question, index) =>
      quizAnswers[index] === question.correct_answer,
  ).length

  const titles: Record<StudyAction, string> = {
    summary: 'Your AI-generated summary',
    quiz: 'Your AI practice quiz',
    flashcards: 'Your AI flashcards',
    weak_topics: 'Your personalised recommendations',
  }

  const cards: {
    icon: string
    title: string
    text: string
    color: string
    action: StudyAction
    tab: Tab
  }[] = [
    {
      icon: 'file',
      title: 'Smart Summaries',
      text: 'Turn lengthy notes into concise summaries.',
      color: 'lavender',
      action: 'summary',
      tab: 'Study Materials',
    },
    {
      icon: 'brain',
      title: 'Practice Quizzes',
      text: 'Test your understanding with custom questions.',
      color: 'peach',
      action: 'quiz',
      tab: 'Quizzes',
    },
    {
      icon: 'cards',
      title: 'Flashcards',
      text: 'Remember key concepts with active recall.',
      color: 'mint',
      action: 'flashcards',
      tab: 'Flashcards',
    },
    {
      icon: 'target',
      title: 'Recommendations',
      text: 'Get suggestions for improving your learning.',
      color: 'blue',
      action: 'weak_topics',
      tab: 'Recommendations',
    },
  ]

  function clearActionResult(action: StudyAction) {
    setGeneratedResults((previous) => ({
      ...previous,
      [action]: '',
    }))
  }

  function resetGeneratedMaterials() {
    setGeneratedResults({
      summary: '',
      quiz: '',
      flashcards: '',
      weak_topics: '',
    })

    setQuizQuestions([])
    setQuizAnswers({})
    setQuizSubmitted(false)
    setGeneratedFlashcards([])
    setCurrentFlashcard(0)
    setShowAnswer(false)
    setFlashcardStatus({})
  }

  function selectPdf(file: File | null) {
    if (!file) return

    const isPdf =
      file.type === 'application/pdf' ||
      file.name.toLowerCase().endsWith('.pdf')

    if (!isPdf) {
      setMessage('Please choose a PDF file.')
      return
    }

    setSelectedFile(file)
    setStudyContent('')
    setLoadedFileName('')
    setMessage('')
    resetGeneratedMaterials()
  }

  async function getMaterial(): Promise<string> {
    if (selectedFile && loadedFileName !== selectedFile.name) {
      const formData = new FormData()
      formData.append('file', selectedFile)

      const response = await fetch(`${API}/api/upload-pdf`, {
        method: 'POST',
        body: formData,
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.detail || 'Could not process the PDF.')
      }

      const text = typeof data.text === 'string' ? data.text : ''

      if (!text.trim()) {
        throw new Error('No readable text was found in this PDF.')
      }

      setStudyContent(text)
      setLoadedFileName(selectedFile.name)

      return text
    }

    return studyContent
  }

  async function generateStudy(action: StudyAction) {
    if (loading) return

    if (!topic.trim() && !selectedFile && !studyContent.trim()) {
      setMessage('Enter a topic or select a PDF first.')
      setActiveTab('Overview')
      return
    }

    setLoading(true)
    setMessage('')
    clearActionResult(action)

    if (action === 'quiz') {
      setQuizQuestions([])
      setQuizAnswers({})
      setQuizSubmitted(false)
    }

    if (action === 'flashcards') {
      setGeneratedFlashcards([])
      setCurrentFlashcard(0)
      setShowAnswer(false)
      setFlashcardStatus({})
    }

    try {
      const content = await getMaterial()

      const response = await fetch(`${API}/api/study`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic: topic.trim(),
          content,
          action,
          question_count: Number(questionCount),
          difficulty,
        }),
      })

      const data: StudyResponse = await response.json()

      if (!response.ok) {
        throw new Error(data.detail || 'AI generation failed.')
      }

      if (action === 'quiz') {
        const questions = data.quiz?.questions

        if (
          !Array.isArray(questions) ||
          questions.length !== Number(questionCount)
        ) {
          throw new Error(
            'The AI returned an invalid quiz. Please generate it again.',
          )
        }

        setQuizQuestions(questions)
        setQuizAnswers({})
        setQuizSubmitted(false)
      } else if (action === 'flashcards') {
        let cards: FlashcardItem[] = []

        if (Array.isArray(data.flashcards)) {
          cards = data.flashcards
        } else if (data.flashcards && 'cards' in data.flashcards) {
          cards = data.flashcards.cards
        }

        if (
          !Array.isArray(cards) ||
          cards.length === 0 ||
          !cards.every(
            (card) =>
              typeof card.question === 'string' &&
              typeof card.answer === 'string',
          )
        ) {
          throw new Error(
            'No valid flashcards were returned. Please generate them again.',
          )
        }

        setGeneratedFlashcards(cards)
        setCurrentFlashcard(0)
        setShowAnswer(false)
        setFlashcardStatus({})
      } else {
        if (!data.result) {
          throw new Error('No result was returned. Please try again.')
        }

        setGeneratedResults((previous) => ({
          ...previous,
          [action]: data.result!,
        }))
      }

      setMessage('Your study material is ready!')
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : 'Could not connect to StudySpark AI. Check that the backend is running.',
      )
    } finally {
      setLoading(false)
    }
  }

  function renderActionResult(action: StudyAction) {
    const actionResult = generatedResults[action]

    if (!actionResult) return null

    return (
      <div className="empty-state result-container">
        <h2>{titles[action]}</h2>

        <div className="markdown-result">
          <ReactMarkdown
            remarkPlugins={[remarkGfm, remarkMath]}
            rehypePlugins={[rehypeKatex]}
            components={{
              td: ({ children, ...props }) => (
                <td {...props}>{renderTextWithBreaks(children)}</td>
              ),
              th: ({ children, ...props }) => (
                <th {...props}>{renderTextWithBreaks(children)}</th>
              ),
            }}
          >
            {actionResult}
          </ReactMarkdown>
        </div>

        <button
          className="secondary-button"
          onClick={() => {
            void navigator.clipboard
              .writeText(actionResult)
              .then(() => setMessage('Result copied to clipboard.'))
              .catch(() => setMessage('Could not copy the result.'))
          }}
        >
          <Icon name="copy" size={16} /> Copy result
        </button>
      </div>
    )
  }

  function goToFlashcard(index: number) {
    setCurrentFlashcard(index)
    setShowAnswer(false)
  }

  function shuffleFlashcards() {
    const shuffled = [...generatedFlashcards]

    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
    }

    setGeneratedFlashcards(shuffled)
    setCurrentFlashcard(0)
    setShowAnswer(false)
    setFlashcardStatus({})
    setMessage('Flashcards shuffled.')
  }

  function markFlashcard(status: 'known' | 'review') {
    setFlashcardStatus((previous) => ({
      ...previous,
      [currentFlashcard]: status,
    }))

    setMessage(
      status === 'known'
        ? 'Marked as known.'
        : 'Added to your review list.',
    )
  }

  const knownCount = Object.values(flashcardStatus).filter(
    (status) => status === 'known',
  ).length

  const reviewCount = Object.values(flashcardStatus).filter(
    (status) => status === 'review',
  ).length

  const currentCard = generatedFlashcards[currentFlashcard]

  return (
    <div className="app-shell" data-theme={theme}>
      <aside className="sidebar">
        <a
          className="brand"
          href="#home"
          onClick={() => setActiveTab('Overview')}
        >
          <span className="brand-icon">
            <Icon name="sparkles" size={22} />
          </span>
          <span>
            StudySpark <span className="brand-accent">AI</span>
          </span>
        </a>

        <div className="sidebar-label">WORKSPACE</div>

        <nav className="navigation" aria-label="Main navigation">
          {tabs.map((tab) => (
            <button
              key={tab.name}
              type="button"
              className={`nav-item ${
                activeTab === tab.name ? 'active' : ''
              }`}
              aria-current={activeTab === tab.name ? 'page' : undefined}
              onClick={() => {
                setActiveTab(tab.name)
                setMessage('')

                if (
                  tab.name === 'Study Materials' &&
                  !generatedResults.summary &&
                  !loading
                ) {
                  void generateStudy('summary')
                }
              }}
            >
              <span className="nav-icon">
                <Icon name={tab.icon} size={19} />
              </span>
              <span>{tab.name}</span>
              {tab.name === 'Quizzes' && (
                <span className="nav-count">AI</span>
              )}
            </button>
          ))}
        </nav>

        <div className="sidebar-bottom">
          <div className="help-card">
            <span className="help-icon">
              <Icon name="sparkles" size={22} />
            </span>
            <h3>Small steps, big progress.</h3>
            <p>Keep showing up. Your future self will thank you.</p>
          </div>

          <div className="profile">
            <div className="avatar">S</div>
            <div>
              <strong>StudySpark workspace</strong>
              <span>Your personal learning space</span>
            </div>
          </div>
        </div>
      </aside>

      <main className="main-content" id="home">
        <header className="topbar">
          <div className="breadcrumb">
            Workspace <span>/</span> {activeTab}
          </div>

          <div className="topbar-right">
            <span className="status-dot" />
            <span className="prototype-label">
              StudySpark AI study workspace
            </span>

            <button
              type="button"
              className="theme-toggle"
              onClick={() =>
                setTheme((current) =>
                  current === 'light' ? 'dark' : 'light',
                )
              }
              aria-label={
                theme === 'light'
                  ? 'Switch to dark mode'
                  : 'Switch to light mode'
              }
              title={
                theme === 'light'
                  ? 'Switch to dark mode'
                  : 'Switch to light mode'
              }
            >
              <Icon name={theme === 'light' ? 'moon' : 'sun'} size={16} />
              {theme === 'light' ? 'Dark' : 'Light'}
            </button>
          </div>
        </header>

        {/* OVERVIEW */}
        {activeTab === 'Overview' && (
          <div className="page">
            <section className="welcome-row">
              <div>
                <div className="eyebrow">
                  YOUR PERSONAL LEARNING SPACE
                </div>
                <h1>
                  Learn smarter, <span>live better.</span>
                </h1>
                <p className="subtitle">
                  Turn your notes into a learning plan that works for you.
                </p>
              </div>

              <div className="welcome-art" aria-hidden="true">
                <div className="art-orbit orbit-one" />
                <div className="art-orbit orbit-two" />
                <span className="art-star star-one">
                  <Icon name="sparkles" size={27} />
                </span>
                <span className="art-star star-two">
                  <Icon name="brain" size={25} />
                </span>
                <div className="art-book">
                  <Icon name="book" size={40} />
                </div>
              </div>
            </section>

            <section className="learn-panel">
              <div className="section-heading">
                <div>
                  <span className="section-kicker">GET STARTED</span>
                  <h2>What would you like to learn today?</h2>
                  <p>
                    Upload your notes or enter a topic to create personalised
                    study materials.
                  </p>
                </div>
                <span className="sparkle">
                  <Icon name="sparkles" size={23} />
                </span>
              </div>

              <label className="input-label" htmlFor="learning-topic">
                LEARNING TOPIC
              </label>

              <div className="topic-input-wrap">
                <span className="search-icon">
                  <Icon name="search" size={19} />
                </span>
                <input
                  id="learning-topic"
                  value={topic}
                  onChange={(event) => {
                    setTopic(event.target.value)
                    setMessage('')
                  }}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      void generateStudy('summary')
                    }
                  }}
                  placeholder="e.g. Database normalization, neural networks..."
                />
              </div>

              <div className="or-divider">
                <span>OR</span>
              </div>

              <button
                type="button"
                className={`upload-area ${dragging ? 'dragging' : ''}`}
                onClick={() => fileInput.current?.click()}
                onDragOver={(event) => {
                  event.preventDefault()
                  setDragging(true)
                }}
                onDragLeave={() => setDragging(false)}
                onDrop={(event) => {
                  event.preventDefault()
                  setDragging(false)
                  selectPdf(event.dataTransfer.files?.[0] ?? null)
                }}
              >
                <span className="upload-icon">
                  <Icon name="upload" size={25} />
                </span>
                <span className="upload-title">
                  {selectedFile
                    ? selectedFile.name
                    : 'Drop your PDF notes here'}
                </span>
                <span className="upload-subtitle">
                  {selectedFile
                    ? 'PDF selected. Click to choose another.'
                    : 'or click to browse - PDF files'}
                </span>
              </button>

              <input
                ref={fileInput}
                type="file"
                accept=".pdf,application/pdf"
                hidden
                onChange={(event) => {
                  selectPdf(event.target.files?.[0] ?? null)
                  event.target.value = ''
                }}
              />

              <div className="learn-footer">
                <span className="privacy-note">
                  <Icon name="check" size={15} />
                  Your materials are processed by your study backend.
                </span>

                <button
                  type="button"
                  className="primary-button"
                  disabled={loading}
                  onClick={() => void generateStudy('summary')}
                >
                  {loading ? 'Generating...' : 'Create study materials'}
                  {!loading && <Icon name="arrow" size={17} />}
                </button>
              </div>

              {loading && (
                <p className="feedback-message" role="status">
                  Working on your study material. Please wait...
                </p>
              )}

              {message && (
                <p className="feedback-message" role="status">
                  {message}
                </p>
              )}
            </section>

            <section className="tools-section">
              <div className="section-heading compact">
                <div>
                  <span className="section-kicker">YOUR STUDY TOOLKIT</span>
                  <h2>Everything you need to master a topic</h2>
                </div>
              </div>

              <div className="tool-grid">
                {cards.map((card) => (
                  <button
                    key={card.title}
                    type="button"
                    className="tool-card"
                    disabled={loading}
                    onClick={() => {
                      setActiveTab(card.tab)
                      setMessage('')
                      void generateStudy(card.action)
                    }}
                  >
                    <span className={`tool-icon ${card.color}`}>
                      <Icon name={card.icon} size={25} />
                    </span>
                    <span className="tool-title">{card.title}</span>
                    <span className="tool-text">{card.text}</span>
                    <span className="tool-arrow">
                      <Icon name="arrow" size={18} />
                    </span>
                  </button>
                ))}
              </div>
            </section>

            <section className="bottom-grid">
              <div className="progress-panel">
                <div className="panel-title-row">
                  <div>
                    <span className="section-kicker">YOUR JOURNEY</span>
                    <h2>Keep learning</h2>
                  </div>
                  <span className="panel-emoji">
                    <Icon name="target" size={25} />
                  </span>
                </div>

                <div className="empty-progress">
                  <span>
                    <Icon name="book" size={27} />
                  </span>
                  <strong>Your learning journey starts here</strong>
                  <p>
                    Create study materials, practise with quizzes, and review
                    concepts with flashcards.
                  </p>
                </div>
              </div>

              <div className="tip-panel">
                <span className="tip-label">A LITTLE STUDY TIP</span>
                <span className="tip-icon">
                  <Icon name="lightbulb" size={25} />
                </span>
                <h3>Recall before you review.</h3>
                <p>
                  Try explaining a concept from memory before looking back at
                  your notes. It can help strengthen what you learn.
                </p>
              </div>
            </section>
          </div>
        )}

        {/* STUDY MATERIALS */}
        {activeTab === 'Study Materials' && (
          <div className="page">
            <div className="page-intro">
              <span className="section-kicker">YOUR LEARNING LIBRARY</span>
              <h1>Study materials</h1>
              <p>
                Your AI-generated summary from your selected topic or uploaded
                PDF.
              </p>
            </div>

            {loading && !generatedResults.summary && (
              <div className="empty-state">
                <span className="empty-icon">
                  <Icon name="file" size={30} />
                </span>
                <h2>Generating your summary...</h2>
                <p>
                  Please wait while your study material is being prepared.
                </p>
              </div>
            )}

            {!loading &&
              !generatedResults.summary &&
              !topic.trim() &&
              !selectedFile &&
              !studyContent.trim() && (
                <div className="empty-state">
                  <span className="empty-icon">
                    <Icon name="book" size={30} />
                  </span>
                  <h2>Start with a learning topic</h2>
                  <p>
                    Enter a topic or upload a PDF on Overview. Your summary
                    will be generated when you open this tab.
                  </p>
                  <button
                    type="button"
                    className="primary-button"
                    onClick={() => setActiveTab('Overview')}
                  >
                    Go to Overview <Icon name="arrow" size={17} />
                  </button>
                </div>
              )}

            {renderActionResult('summary')}

            {message && (
              <p className="feedback-message" role="status">
                {message}
              </p>
            )}
          </div>
        )}

        {/* QUIZZES */}
        {activeTab === 'Quizzes' && (
          <div className="page">
            <div className="page-intro">
              <span className="section-kicker">TEST YOUR KNOWLEDGE</span>
              <h1>Practice quizzes</h1>
              <p>
                Choose your quiz settings, answer the questions, and submit to
                see your score and explanations.
              </p>
            </div>

            <div className="quiz-preview">
              <h2>Configure your quiz</h2>
              <p>
                Study material:{' '}
                {topic ||
                  selectedFile?.name ||
                  'Choose a topic or PDF on Overview'}
              </p>

              <div className="quiz-settings">
                <div className="quiz-setting-field">
                  <label htmlFor="question-count">
                    Number of questions
                  </label>
                  <select
                    id="question-count"
                    value={questionCount}
                    disabled={loading || quizQuestions.length > 0}
                    onChange={(event) =>
                      setQuestionCount(event.target.value)
                    }
                  >
                    <option value="5">5 questions</option>
                    <option value="10">10 questions</option>
                    <option value="15">15 questions</option>
                    <option value="20">20 questions</option>
                  </select>
                </div>

                <div className="quiz-setting-field">
                  <label htmlFor="quiz-difficulty">Difficulty</label>
                  <select
                    id="quiz-difficulty"
                    value={difficulty}
                    disabled={loading || quizQuestions.length > 0}
                    onChange={(event) => setDifficulty(event.target.value)}
                  >
                    <option value="Easy">Easy</option>
                    <option value="Medium">Medium</option>
                    <option value="Hard">Hard</option>
                    <option value="Mixed">Mixed</option>
                  </select>
                </div>
              </div>

              {quizQuestions.length > 0 ? (
                <button
                  type="button"
                  className="secondary-button"
                  disabled={loading}
                  onClick={() => {
                    setQuizQuestions([])
                    setQuizAnswers({})
                    setQuizSubmitted(false)
                    setMessage('')
                  }}
                >
                  Change quiz settings
                </button>
              ) : (
                <button
                  type="button"
                  className="primary-button"
                  disabled={loading}
                  onClick={() => void generateStudy('quiz')}
                >
                  {loading ? 'Generating quiz...' : 'Generate AI quiz'}
                  {!loading && <Icon name="arrow" size={17} />}
                </button>
              )}
            </div>

            {loading && (
              <p className="feedback-message" role="status">
                Generating your quiz. Please wait...
              </p>
            )}

            {quizQuestions.length > 0 && (
              <div className="quiz-container">
                <div className="quiz-heading">
                  <div>
                    <span className="section-kicker">YOUR QUIZ</span>
                    <h2>
                      {quizSubmitted
                        ? 'Quiz results'
                        : 'Answer the questions'}
                    </h2>
                  </div>
                  <span className="quiz-counter">
                    {quizQuestions.length} questions
                  </span>
                </div>

                {!quizSubmitted && (
                  <div className="quiz-progress-wrap">
                    <div className="quiz-progress-labels">
                      <span>Quiz progress</span>
                      <strong>
                        {Object.keys(quizAnswers).length} of{' '}
                        {quizQuestions.length} answered
                      </strong>
                    </div>
                    <div className="quiz-progress-track">
                      <div
                        className="quiz-progress-fill"
                        style={{
                          width: `${
                            (Object.keys(quizAnswers).length /
                              quizQuestions.length) *
                            100
                          }%`,
                        }}
                      />
                    </div>
                  </div>
                )}

                {quizSubmitted && (
                  <div className="quiz-score">
                    <span className="section-kicker">YOUR SCORE</span>
                    <h2>
                      {quizScore} / {quizQuestions.length}
                    </h2>
                    <p>
                      {Math.round(
                        (quizScore / quizQuestions.length) * 100,
                      )}
                      % correct
                    </p>
                  </div>
                )}

                {quizQuestions.map((question, index) => {
                  const selectedAnswer = quizAnswers[index]
                  const isCorrect =
                    selectedAnswer === question.correct_answer

                  return (
                    <div
                      className="quiz-question"
                      key={`${index}-${question.question}`}
                    >
                      <div className="quiz-question-title">
                        <span className="quiz-question-number">
                          QUESTION {String(index + 1).padStart(2, '0')}
                        </span>
                        {quizSubmitted && (
                          <span
                            className={
                              isCorrect ? 'answer-correct' : 'answer-wrong'
                            }
                          >
                            {isCorrect ? 'Correct' : 'Incorrect'}
                          </span>
                        )}
                      </div>

                      <h3>{question.question}</h3>

                      <div className="quiz-options">
                        {question.options.map((option) => {
                          const isSelected = selectedAnswer === option.id
                          const isRightAnswer =
                            option.id === question.correct_answer

                          let optionClass = 'quiz-option'

                          if (isSelected) optionClass += ' selected'

                          if (quizSubmitted && isRightAnswer) {
                            optionClass += ' correct-option'
                          } else if (
                            quizSubmitted &&
                            isSelected &&
                            !isCorrect
                          ) {
                            optionClass += ' incorrect-option'
                          }

                          return (
                            <label
                              className={optionClass}
                              key={option.id}
                            >
                              <input
                                type="radio"
                                name={`question-${index}`}
                                value={option.id}
                                checked={isSelected}
                                disabled={quizSubmitted}
                                onChange={() =>
                                  setQuizAnswers((previous) => ({
                                    ...previous,
                                    [index]: option.id,
                                  }))
                                }
                              />
                              <span className="option-letter">
                                {option.id}
                              </span>
                              <span>{option.text}</span>
                            </label>
                          )
                        })}
                      </div>

                      {quizSubmitted && (
                        <div className="quiz-explanation">
                          <strong>Explanation</strong>
                          <p>{question.explanation}</p>
                        </div>
                      )}
                    </div>
                  )
                })}

                {!quizSubmitted ? (
                  <div className="quiz-submit-area">
                    <p>
                      Answered {Object.keys(quizAnswers).length} of{' '}
                      {quizQuestions.length} questions
                    </p>
                    <button
                      type="button"
                      className="primary-button"
                      disabled={
                        Object.keys(quizAnswers).length !==
                        quizQuestions.length
                      }
                      onClick={() => {
                        setQuizSubmitted(true)
                        setMessage('')
                        window.scrollTo({ top: 0, behavior: 'smooth' })
                      }}
                    >
                      Submit quiz
                      <Icon name="arrow" size={17} />
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    className="primary-button"
                    onClick={() => {
                      setQuizQuestions([])
                      setQuizAnswers({})
                      setQuizSubmitted(false)
                      setMessage('')
                    }}
                  >
                    Create another quiz
                    <Icon name="arrow" size={17} />
                  </button>
                )}
              </div>
            )}

            {message && (
              <p className="feedback-message" role="status">
                {message}
              </p>
            )}
          </div>
        )}

        {/* FLASHCARDS */}
        {activeTab === 'Flashcards' && (
          <div className="page">
            <div className="page-intro">
              <span className="section-kicker">ACTIVE RECALL</span>
              <h1>Flashcards</h1>
              <p>
                Think of the answer, flip the card, and track what you know.
              </p>
            </div>

            <div className="empty-state flashcard-source-panel">
              <h2>Your study deck</h2>
              <p>
                Source:{' '}
                {topic ||
                  selectedFile?.name ||
                  'Choose a topic or PDF on Overview'}
              </p>
              <button
                type="button"
                className="primary-button"
                disabled={loading}
                onClick={() => void generateStudy('flashcards')}
              >
                {loading
                  ? 'Creating your deck...'
                  : generatedFlashcards.length > 0
                    ? 'Generate a new deck'
                    : 'Generate flashcards'}
                {!loading && <Icon name="arrow" size={17} />}
              </button>
            </div>

            {loading && (
              <div className="flashcards-empty-state" role="status">
                <div className="flashcards-loading-mark">
                  <Icon name="sparkles" size={28} />
                </div>
                <h3>Creating your flashcards...</h3>
                <p>
                  Turning important concepts into question-and-answer cards.
                </p>
              </div>
            )}

            {!loading && generatedFlashcards.length === 0 && (
              <div className="flashcards-empty-state">
                <div className="flashcards-empty-icon">
                  <Icon name="cards" size={32} />
                </div>
                <h3>Your deck will appear here</h3>
                <p>
                  Generate flashcards from your topic or uploaded PDF to start
                  practising active recall.
                </p>
              </div>
            )}

            {!loading && currentCard && (
              <section className="flashcard-study">
                <div className="flashcard-toolbar">
                  <div>
                    <span className="section-kicker">YOUR STUDY DECK</span>
                    <h2>Card {currentFlashcard + 1}</h2>
                  </div>
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={shuffleFlashcards}
                  >
                    <Icon name="shuffle" size={16} /> Shuffle deck
                  </button>
                </div>

                <div className="flashcard-progress-labels">
                  <span>
                    Card {currentFlashcard + 1} of{' '}
                    {generatedFlashcards.length}
                  </span>
                  <span>
                    {Math.round(
                      ((currentFlashcard + 1) /
                        generatedFlashcards.length) *
                        100,
                    )}
                    %
                  </span>
                </div>

                <div className="flashcard-progress-track">
                  <div
                    className="flashcard-progress-fill"
                    style={{
                      width: `${
                        ((currentFlashcard + 1) /
                          generatedFlashcards.length) *
                        100
                      }%`,
                    }}
                  />
                </div>

                <button
                  type="button"
                  className={`real-flashcard ${
                    showAnswer ? 'is-flipped' : ''
                  }`}
                  onClick={() => setShowAnswer((previous) => !previous)}
                  aria-label={
                    showAnswer
                      ? 'Show question'
                      : 'Flip card to reveal answer'
                  }
                >
                  <span className="real-flashcard-inner">
                    <span className="real-flashcard-face real-flashcard-front">
                      <span className="flashcard-label">QUESTION</span>
                      <span className="real-flashcard-content">
                        {currentCard.question}
                      </span>
                      <span className="flashcard-hint">
                        Click to reveal answer
                      </span>
                    </span>
                    <span className="real-flashcard-face real-flashcard-back">
                      <span className="flashcard-label">ANSWER</span>
                      <span className="real-flashcard-content">
                        {currentCard.answer}
                      </span>
                      <span className="flashcard-hint">
                        Click to see question
                      </span>
                    </span>
                  </span>
                </button>

                <div className="flashcard-review-actions">
                  <button
                    type="button"
                    className="secondary-button review-again-button"
                    onClick={() => markFlashcard('review')}
                  >
                    Review again
                  </button>
                  <button
                    type="button"
                    className="primary-button got-it-button"
                    onClick={() => markFlashcard('known')}
                  >
                    <Icon name="check" size={17} /> Got it
                  </button>
                </div>

                <div className="flashcard-status-summary">
                  <span>
                    <strong>{knownCount}</strong> known
                  </span>
                  <span>
                    <strong>{reviewCount}</strong> to review
                  </span>
                </div>

                <div className="flashcard-navigation">
                  <button
                    type="button"
                    className="secondary-button"
                    disabled={currentFlashcard === 0}
                    onClick={() => goToFlashcard(currentFlashcard - 1)}
                  >
                    Previous
                  </button>
                  <span>
                    {currentFlashcard + 1} / {generatedFlashcards.length}
                  </span>
                  <button
                    type="button"
                    className="primary-button"
                    disabled={
                      currentFlashcard === generatedFlashcards.length - 1
                    }
                    onClick={() => goToFlashcard(currentFlashcard + 1)}
                  >
                    Next <Icon name="arrow" size={16} />
                  </button>
                </div>

                {currentFlashcard === generatedFlashcards.length - 1 && (
                  <p className="flashcard-complete-message">
                    You've reached the end of this deck. Shuffle the cards
                    or generate a new deck to practise again.
                  </p>
                )}
              </section>
            )}

            {message && (
              <p className="feedback-message" role="status">
                {message}
              </p>
            )}
          </div>
        )}

        {/* RECOMMENDATIONS */}
        {activeTab === 'Recommendations' && (
          <div className="page">
            <div className="page-intro">
              <span className="section-kicker">REFLECT AND IMPROVE</span>
              <h1>Recommendations</h1>
              <p>
                Get practical suggestions for what to revise and how to
                improve your understanding of the material.
              </p>
            </div>

            <div className="empty-state recommendation-panel">
              <span className="empty-icon">
                <Icon name="target" size={30} />
              </span>
              <h2>Personalised learning recommendations</h2>
              <p>
                Analyse your study material to identify important concepts,
                areas that may need more attention, and suggested revision
                priorities.
              </p>
              <button
                type="button"
                className="primary-button"
                disabled={loading}
                onClick={() => void generateStudy('weak_topics')}
              >
                {loading ? 'Preparing recommendations...' : 'Get recommendations'}
                {!loading && <Icon name="arrow" size={17} />}
              </button>
            </div>

            {loading && (
              <p className="feedback-message" role="status">
                Reviewing your material and preparing recommendations...
              </p>
            )}

            {renderActionResult('weak_topics')}

            {message && (
              <p className="feedback-message" role="status">
                {message}
              </p>
            )}
          </div>
        )}
      </main>
    </div>
  )
}

export default App

