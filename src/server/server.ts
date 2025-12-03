import express from 'express';
import cors from 'cors';
import { Pool } from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { MongoClient } from 'mongodb';

// Load environment variables from server.env file
dotenv.config({ path: path.join(__dirname, 'server.env') });

const app = express();
const port = process.env.PORT || 3001;

// PostgreSQL connection configuration
const pgPool = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'postgres',
  password: process.env.DB_PASSWORD || '',
  port: parseInt(process.env.DB_PORT || '5432'),
  connectionTimeoutMillis: 5000,
});

// MongoDB URI from environment variable
const mongoURI = process.env.MONGODB_URI || 'mongodb+srv://Vercel-Admin-atlas-blue-elephant:awdawfgwg@atlas-blue-elephant.s08ch7i.mongodb.net/?retryWrites=true&w=majority';

// Create MongoClient instance
const mongoClient = new MongoClient(mongoURI, {
  socketTimeoutMS: 30000,
  connectTimeoutMS: 10000,
});

// Test MongoDB connection function
const testMongoConnection = async () => {
  try {
    await mongoClient.connect(); // Establish the connection
    const db = mongoClient.db(); // Get a reference to the default database
    const result = await db.command({ ping: 1 }); // MongoDB "ping" command to check the connection

    console.log('✅ MongoDB connection successful');
    return true;
  } catch (error) {
    console.error('❌ MongoDB connection failed:');
    console.error('Error details:', error);
    return false;
  }
};

// Test PostgreSQL connection function
const testPgConnection = async () => {
  try {
    const client = await pgPool.connect();
    const result = await client.query('SELECT version()');
    client.release();
    console.log('✅ PostgreSQL connection successful');
    return true;
  } catch (error) {
    console.error('❌ PostgreSQL connection failed:');
    console.error('Error details:', error);
    return false;
  }
};

// Initialize database
const initializeDatabase = async () => {
  try {
    const client = await pgPool.connect();

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
    }
    client.release();
  } catch (error) {
    console.error('❌ Error initializing database:', error);
    throw error;
  }
};

// Middleware
app.use(cors());
app.use(express.json());

// Routes

// Get all questions
app.get('/api/questions', async (req, res) => {
  try {
    const result = await pgPool.query(`
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

// Health check endpoint
app.get('/api/health', async (req, res) => {
  try {
    const pgConnected = await testPgConnection();
    const mongoConnected = await testMongoConnection();

    if (pgConnected && mongoConnected) {
      res.json({
        status: 'OK',
        databases: 'Connected',
        timestamp: new Date().toISOString()
      });
    } else {
      res.status(500).json({
        status: 'Error',
        databases: 'Disconnected',
        error: 'Could not connect to databases'
      });
    }
  } catch (error) {
    res.status(500).json({
      status: 'Error',
      databases: 'Disconnected',
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

// Start server
const startServer = async () => {
  try {
    const pgConnected = await testPgConnection();
    const mongoConnected = await testMongoConnection();

    if (!pgConnected || !mongoConnected) {
      process.exit(1);
    }

    // Initialize database
    await initializeDatabase();

    app.listen(port, () => {
      console.log(`Server running on port ${port}`);
    });
  } catch (error) {
    console.error('❌ Server startup failed:', error);
    process.exit(1);
  }
};

// Handle graceful shutdown
process.on('SIGINT', async () => {
  await pgPool.end();
  await mongoClient.close();
  process.exit(0);
});

// Start the server
startServer();

export default app;
