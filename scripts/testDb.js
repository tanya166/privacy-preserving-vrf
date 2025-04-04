const pool = require('../backend/database');

async function testDBConnection() {
  try {
    // Simple query to test connection
    const result = await pool.query('SELECT NOW()');
    console.log('Database connection successful!');
    console.log('Current time from DB:', result.rows[0]);
    
    // Check if your table exists
    const tableCheck = await pool.query(
      "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'time_series_vrf')"
    );
    console.log('Table exists:', tableCheck.rows[0].exists);
    
    pool.end(); // Close the connection
  } catch (error) {
    console.error('Database connection failed:', error);
  }
}

testDBConnection();