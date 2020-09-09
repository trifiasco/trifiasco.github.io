import React from "react";
import Sidebar from "../sidebar";
import Home from "../home";
import About from "../about";
import Experience from "../experience";
import Skills from "../skills";
import Education from "../education";
import Achievements from "../achievements";

const Main = (props) => {
  return (
    <div id="template-page">
      <div id="container-wrap">
        <Sidebar />
        <div id="template-main">
          <Home />
          <About />
          <Experience />
          <Skills />
          <Education />
          <Achievements />
        </div>
      </div>
    </div>
  );
};

export default Main;
