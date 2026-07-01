import React from 'react';
import './App.css';

function App() {
    return (
          <div className="App">
            <header className="App-header">
              <h1>Reviews Analytics</h1>
          <p>Modern React Application for Analytics Platform</p>
          <div className="hero-section">
                <h2>Welcome to Reviews Analytics</h2>
            <p>Analyze and visualize reviews data with powerful analytics tools.</p>
            <button className="cta-button">Get Started</button>
      </div>
      </header>
        <main>
              <section className="features">
                <h2>Key Features</h2>
            <div className="feature-grid">
                  <div className="feature-card">
                    <h3>Real-time Analytics</h3>
                <p>Track reviews and ratings in real-time with live updates.</p>
      </div>
              <div className="feature-card">
                    <h3>Detailed Reports</h3>
                <p>Generate comprehensive reports on review trends and patterns.</p>
      </div>
              <div className="feature-card">
                    <h3>Data Visualization</h3>
                <p>Interactive charts and graphs for better data insights.</p>
      </div>
      </div>
      </section>
      </main>
        <footer>
              <p>&copy; 2026 Reviews Analytics. All rights reserved.</p>
      </footer>
      </div>
    );
}

export default App;
