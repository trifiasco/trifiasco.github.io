import React from "react";
import Sidebar from "../components/sidebar";
import Home from "../components/home";
import About from "../components/about";
import Experience from "../components/experience";
import Education from "../components/education";
import Skills from "../components/skills";
import Achievements from "../components/achievements";
import Projects from "../components/projects";
import Contact from "../components/contact";
import logo from "../logo.svg";
import "../App.css";
import backgroundPic from "../images/background1.png";

function Main() {
  return (
    <div id="template-page">
      <div id="container-wrap">
        <Sidebar></Sidebar>
        <div id="template-main">
          <Home></Home>
          <About></About>
          <Experience></Experience>
          <Skills></Skills>
          {/* <Projects></Projects> */}
          <Education></Education>
          <Achievements></Achievements>
          {/* <Contact></Contact> */}
        </div>
      </div>
    </div>
  );
}

export default Main;
