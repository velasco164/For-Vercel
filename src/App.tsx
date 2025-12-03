import React, { useState, useEffect, useCallback } from 'react';
import './index.css';

interface Question {
  id: number;
  question: string;
  options: string[];
  correctAnswer: number;
  explanation: string;
}

const API_BASE_URL = 'http://localhost:3001/api';

// Move EditQuestionForm outside the main component to prevent recreation
interface EditQuestionFormProps {
  editingQuestion: Question;
  quizQuestions: Question[];
  error: string | null;
  onSave: () => void;
  onCancel: () => void;
  onDelete: (id: number) => void;
  onQuestionChange: (value: string) => void;
  onExplanationChange: (value: string) => void;
  onOptionChange: (index: number, value: string) => void;
  onCorrectAnswerChange: (index: number) => void;
}

const EditQuestionForm: React.FC<EditQuestionFormProps> = ({
  editingQuestion,
  quizQuestions,
  error,
  onSave,
  onCancel,
  onDelete,
  onQuestionChange,
  onExplanationChange,
  onOptionChange,
  onCorrectAnswerChange,
}) => {
  return (
    <div className="edit-modal">
      <div className="edit-form">
        <h3>{editingQuestion.id > Math.max(...quizQuestions.map(q => q.id)) ? 'Add Question' : 'Edit Question'}</h3>
        
        {error && <div className="error-message">{error}</div>}
        
        <div className="form-group">
          <label>Question:</label>
          <textarea
            value={editingQuestion.question}
            onChange={(e) => onQuestionChange(e.target.value)}
            rows={3}
            placeholder="Enter your question here..."
            className="form-textarea"
          />
        </div>

        <div className="form-group">
          <label>Options (select the correct one):</label>
          <div className="options-edit-container">
            {editingQuestion.options.map((option, index) => (
              <div key={index} className="option-edit-item">
                <label className="option-edit-label">
                  <input
                    type="radio"
                    name="correctAnswer"
                    checked={editingQuestion.correctAnswer === index}
                    onChange={() => onCorrectAnswerChange(index)}
                    className="correct-answer-radio"
                  />
                  <span className="option-number">Option {index + 1}:</span>
                  <input
                    type="text"
                    value={option}
                    onChange={(e) => onOptionChange(index, e.target.value)}
                    placeholder={`Enter option ${index + 1}`}
                    className="option-input"
                  />
                </label>
              </div>
            ))}
          </div>
        </div>

        <div className="form-group">
          <label>Explanation:</label>
          <textarea
            value={editingQuestion.explanation}
            onChange={(e) => onExplanationChange(e.target.value)}
            rows={3}
            placeholder="Explain why this answer is correct..."
            className="form-textarea"
          />
        </div>

        <div className="form-actions">
          <button onClick={onSave} className="save-btn">
            Save Question
          </button>
          <button onClick={onCancel} className="cancel-btn">
            Cancel
          </button>
          {editingQuestion.id <= Math.max(...quizQuestions.map(q => q.id)) && (
            <button 
              onClick={() => onDelete(editingQuestion.id)} 
              className="delete-btn"
            >
              Delete Question
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

const QuizGame: React.FC = () => {
  const [quizQuestions, setQuizQuestions] = useState<Question[]>([]);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  const [showResult, setShowResult] = useState(false);
  const [quizCompleted, setQuizCompleted] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<Question | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch questions from database
  const fetchQuestions = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch(`${API_BASE_URL}/questions`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch questions');
      }
      
      const questions = await response.json();
      setQuizQuestions(questions);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      console.error('Error fetching questions:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQuestions();
  }, []);

  // Use useCallback to stabilize the functions
  const handleQuestionChange = useCallback((value: string) => {
    if (editingQuestion) {
      setEditingQuestion({
        ...editingQuestion,
        question: value
      });
    }
  }, [editingQuestion]);

  const handleExplanationChange = useCallback((value: string) => {
    if (editingQuestion) {
      setEditingQuestion({
        ...editingQuestion,
        explanation: value
      });
    }
  }, [editingQuestion]);

  const handleOptionChange = useCallback((index: number, value: string) => {
    if (editingQuestion) {
      const newOptions = [...editingQuestion.options];
      newOptions[index] = value;
      setEditingQuestion({
        ...editingQuestion,
        options: newOptions
      });
    }
  }, [editingQuestion]);

  const handleCorrectAnswerChange = useCallback((index: number) => {
    if (editingQuestion) {
      setEditingQuestion({
        ...editingQuestion,
        correctAnswer: index
      });
    }
  }, [editingQuestion]);

  const handleAnswerSelect = (optionIndex: number) => {
    setSelectedAnswer(optionIndex);
  };

  const handleSubmit = () => {
    if (selectedAnswer === null) return;

    if (selectedAnswer === quizQuestions[currentQuestion].correctAnswer) {
      setScore(score + 1);
    }

    setShowResult(true);
  };

  const handleNext = () => {
    if (currentQuestion < quizQuestions.length - 1) {
      setCurrentQuestion(currentQuestion + 1);
      setSelectedAnswer(null);
      setShowResult(false);
    } else {
      setQuizCompleted(true);
    }
  };

  const handleRestart = () => {
    setCurrentQuestion(0);
    setSelectedAnswer(null);
    setScore(0);
    setShowResult(false);
    setQuizCompleted(false);
  };

  const handleEditQuestion = (question: Question) => {
    setEditingQuestion({ ...question });
    setEditMode(true);
  };

  const handleSaveQuestion = async () => {
    if (!editingQuestion) return;

    try {
      setError(null);
      const url = editingQuestion.id > Math.max(...quizQuestions.map(q => q.id)) 
        ? `${API_BASE_URL}/questions`
        : `${API_BASE_URL}/questions/${editingQuestion.id}`;

      const method = editingQuestion.id > Math.max(...quizQuestions.map(q => q.id)) ? 'POST' : 'PUT';

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          question: editingQuestion.question,
          options: editingQuestion.options,
          correctAnswer: editingQuestion.correctAnswer,
          explanation: editingQuestion.explanation,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to save question');
      }

      await fetchQuestions();
      setEditMode(false);
      setEditingQuestion(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save question');
      console.error('Error saving question:', err);
    }
  };

  const handleCancelEdit = () => {
    setEditMode(false);
    setEditingQuestion(null);
    setError(null);
  };

  const handleAddQuestion = () => {
    const newQuestion: Question = {
      id: Math.max(0, ...quizQuestions.map(q => q.id)) + 1,
      question: "New Question",
      options: ["Option 1", "Option 2", "Option 3", "Option 4"],
      correctAnswer: 0,
      explanation: "Explanation for the new question"
    };
    setEditingQuestion(newQuestion);
    setEditMode(true);
  };

  const handleDeleteQuestion = async (questionId: number) => {
    if (quizQuestions.length <= 1) {
      alert("Cannot delete the last question!");
      return;
    }

    try {
      setError(null);
      const response = await fetch(`${API_BASE_URL}/questions/${questionId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete question');
      }

      await fetchQuestions();
      
      if (currentQuestion >= quizQuestions.length - 1) {
        setCurrentQuestion(0);
        setSelectedAnswer(null);
        setShowResult(false);
      }
      
      setEditMode(false);
      setEditingQuestion(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete question');
      console.error('Error deleting question:', err);
    }
  };

  if (loading) {
    return (
      <div className="quiz-container">
        <div className="loading-screen">
          <h2>Loading Quiz...</h2>
          <div className="spinner"></div>
        </div>
      </div>
    );
  }

  if (error && quizQuestions.length === 0) {
    return (
      <div className="quiz-container">
        <div className="error-screen">
          <h2>Error Loading Quiz</h2>
          <p>{error}</p>
          <button onClick={fetchQuestions} className="retry-button">
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (editMode && editingQuestion) {
    return (
      <EditQuestionForm
        editingQuestion={editingQuestion}
        quizQuestions={quizQuestions}
        error={error}
        onSave={handleSaveQuestion}
        onCancel={handleCancelEdit}
        onDelete={handleDeleteQuestion}
        onQuestionChange={handleQuestionChange}
        onExplanationChange={handleExplanationChange}
        onOptionChange={handleOptionChange}
        onCorrectAnswerChange={handleCorrectAnswerChange}
      />
    );
  }

  if (quizCompleted) {
    return (
      <div className="quiz-container">
        <div className="completion-screen">
          <h2>Quiz Completed! 🎉</h2>
          <div className="score-display">
            Your score: <span className="score-value">{score}</span> out of {quizQuestions.length}
          </div>
          <div className="score-percentage">
            {Math.round((score / quizQuestions.length) * 100)}%
          </div>
          <div className="completion-actions">
            <button className="restart-button" onClick={handleRestart}>
              Play Again
            </button>
            <button 
              className="edit-questions-button" 
              onClick={() => setEditMode(true)}
            >
              Edit Questions
            </button>
          </div>
        </div>
      </div>
    );
  }

  const question = quizQuestions[currentQuestion];

  return (
    <div className="quiz-container">
      {error && <div className="error-banner">{error}</div>}
      
      <div className="quiz-header">
        <h1>Knowledge Quiz</h1>
        <div className="header-controls">
          <div className="progress">
            Question {currentQuestion + 1} of {quizQuestions.length}
          </div>
          <div className="score">Score: {score}</div>
        </div>
        <button 
          className="edit-button"
          onClick={() => handleEditQuestion(question)}
          title="Edit current question"
        >
          ✏️ Edit
        </button>
      </div>

      <div className="question-card">
        <h2 className="question-text">{question.question}</h2>
        
        <div className="options-container">
          {question.options.map((option, index) => (
            <button
              key={index}
              className={`option-button ${
                selectedAnswer === index ? 'selected' : ''
              } ${
                showResult
                  ? index === question.correctAnswer
                    ? 'correct'
                    : selectedAnswer === index
                    ? 'incorrect'
                    : ''
                  : ''
              }`}
              onClick={() => !showResult && handleAnswerSelect(index)}
              disabled={showResult}
            >
              {option}
            </button>
          ))}
        </div>

        {showResult && (
          <div className="result-section">
            <div className={`feedback ${
              selectedAnswer === question.correctAnswer ? 'correct-feedback' : 'incorrect-feedback'
            }`}>
              {selectedAnswer === question.correctAnswer ? '✅ Correct!' : '❌ Incorrect'}
            </div>
            <div className="explanation">
              {question.explanation}
            </div>
            <button className="next-button" onClick={handleNext}>
              {currentQuestion < quizQuestions.length - 1 ? 'Next Question' : 'See Results'}
            </button>
          </div>
        )}

        {!showResult && selectedAnswer !== null && (
          <button className="submit-button" onClick={handleSubmit}>
            Submit Answer
          </button>
        )}
      </div>

      <div className="quiz-footer">
        <button 
          className="add-question-button"
          onClick={handleAddQuestion}
        >
          + Add New Question
        </button>
        
        <button 
          className="refresh-button"
          onClick={fetchQuestions}
          title="Refresh questions from server"
        >
          🔄 Refresh
        </button>
      </div>
    </div>
  );
};

export default QuizGame;