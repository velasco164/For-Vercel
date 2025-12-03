import express from 'express';
import cors from 'cors';
import { Pool } from 'pg';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables from server.env file
dotenv.config({ path: path.join(__dirname, 'server.env') });

const app = express();
const port = process.env.PORT || 3001;


// PostgreSQL connection configuration
const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'postgres',
  password: process.env.DB_PASSWORD || '',
  port: parseInt(process.env.DB_PORT || '5432'),
  connectionTimeoutMillis: 5000,
});

// Test database connection
const testConnection = async () => {
  try {
    const client = await pool.connect();
    
    const result = await client.query('SELECT version()');

    client.release();
    return true;
  } catch (error) {
    console.error('❌ Database connection failed:');
    console.error('Error details:', error);
    return false;
  }
};

// Initialize database table
const initializeDatabase = async () => {
  try {
    const client = await pool.connect();
    
    // Create questions table if it doesn't exist
    await client.query(`
      CREATE TABLE IF NOT EXISTS questions (
        id SERIAL PRIMARY KEY,
        question TEXT NOT NULL,
        options TEXT[] NOT NULL,
        correct_answer INTEGER NOT NULL,
        explanation TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Check if table is empty and insert sample data
    const countResult = await client.query('SELECT COUNT(*) FROM questions');
    const questionCount = parseInt(countResult.rows[0].count);

    if (questionCount === 0) {
     
      const sampleQuestions = [
        {
          question: "What is the capital of France?",
          options: ["London", "Berlin", "Paris", "Madrid"],
          correct_answer: 2,
          explanation: "Paris has been the capital of France since the 12th century."
        },
        {
          question: "Which planet is known as the Red Planet?",
          options: ["Venus", "Mars", "Jupiter", "Saturn"],
          correct_answer: 1,
          explanation: "Mars appears red due to iron oxide (rust) on its surface."
        },
        {
          question: "What is the largest mammal in the world?",
          options: ["African Elephant", "Blue Whale", "Giraffe", "Polar Bear"],
          correct_answer: 1,
          explanation: "The Blue Whale can grow up to 100 feet long and weigh 200 tons."
        }
      ];

      for (const question of sampleQuestions) {
        await client.query(
          'INSERT INTO questions (question, options, correct_answer, explanation) VALUES ($1, $2, $3, $4)',
          [question.question, question.options, question.correct_answer, question.explanation]
        );
      }
     
    } else {
      
    }

    
    client.release();
  } catch (error) {
    
    throw error;
  }
};

// Middleware
app.use(cors());
app.use(express.json());

// Logging middleware
app.use((req, res, next) => {
  
  next();
});

// Routes

// Get all questions
app.get('/api/questions', async (req, res) => {
  try {
    
    const result = await pool.query(`
      SELECT id, question, options, correct_answer as "correctAnswer", explanation 
      FROM questions 
      ORDER BY id
    `);
    
    res.json(result.rows);
  } catch (error) {
    console.error('❌ Error fetching questions:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get single question by ID
app.get('/api/questions/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    
    const result = await pool.query(`
      SELECT id, question, options, correct_answer as "correctAnswer", explanation 
      FROM questions 
      WHERE id = $1
    `, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Question not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('❌ Error fetching question:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create new question
app.post('/api/questions', async (req, res) => {
  try {
    const { question, options, correctAnswer, explanation } = req.body;
    

    // Validation
    if (!question || !options || !Array.isArray(options) || options.length !== 4) {
      return res.status(400).json({ error: 'Question must have 4 options' });
    }

    if (correctAnswer < 0 || correctAnswer > 3) {
      return res.status(400).json({ error: 'Correct answer must be between 0 and 3' });
    }

    const result = await pool.query(`
      INSERT INTO questions (question, options, correct_answer, explanation)
      VALUES ($1, $2, $3, $4)
      RETURNING id, question, options, correct_answer as "correctAnswer", explanation
    `, [question, options, correctAnswer, explanation]);

    
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('❌ Error creating question:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update question
app.put('/api/questions/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { question, options, correctAnswer, explanation } = req.body;
    

    // Validation
    if (!question || !options || !Array.isArray(options) || options.length !== 4) {
      return res.status(400).json({ error: 'Question must have 4 options' });
    }

    if (correctAnswer < 0 || correctAnswer > 3) {
      return res.status(400).json({ error: 'Correct answer must be between 0 and 3' });
    }

    const result = await pool.query(`
      UPDATE questions 
      SET question = $1, options = $2, correct_answer = $3, explanation = $4, updated_at = CURRENT_TIMESTAMP
      WHERE id = $5
      RETURNING id, question, options, correct_answer as "correctAnswer", explanation
    `, [question, options, correctAnswer, explanation, id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Question not found' });
    }

    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('❌ Error updating question:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete question
app.delete('/api/questions/:id', async (req, res) => {
  try {
    const { id } = req.params;
    

    // Check if this is the last question
    const countResult = await pool.query('SELECT COUNT(*) FROM questions');
    const questionCount = parseInt(countResult.rows[0].count);

    if (questionCount <= 1) {
      return res.status(400).json({ error: 'Cannot delete the last question' });
    }

    const result = await pool.query('DELETE FROM questions WHERE id = $1 RETURNING *', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Question not found' });
    }

    
    res.json({ message: 'Question deleted successfully' });
  } catch (error) {
    console.error('❌ Error deleting question:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Health check endpoint
app.get('/api/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ 
      status: 'OK', 
      database: 'Connected',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ 
      status: 'Error', 
      database: 'Disconnected',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    message: 'Quiz Game Server is running!',
    endpoints: {
      health: '/api/health',
      questions: '/api/questions',
      documentation: 'See README for API documentation'
    }
  });
});

// Simple 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

// Start server
const startServer = async () => {
  try {
   
    
    // Test database connection first
    const dbConnected = await testConnection();
    if (!dbConnected) {
     
      process.exit(1);
    }
    
    // Initialize database
    await initializeDatabase();
    
    // Start listening
    app.listen(port, () => {
     
    });
  } catch (error) {
    
    process.exit(1);
  }
};

// Handle graceful shutdown
process.on('SIGINT', async () => {
 
  await pool.end();
  process.exit(0);
});

// Start the server
startServer();

export default app;