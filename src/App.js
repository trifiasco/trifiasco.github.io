import React from 'react';
import './App.css';
import ParticlesBg from 'particles-bg';
import Main from './components/main';

function App() {
  return (
    <div>
      <div id="particle"><ParticlesBg type="cobweb" bg={true} num={40}/></div>
      <Main />
    </div>
  );
}

export default App;
