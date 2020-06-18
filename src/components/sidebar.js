import React, {Component} from 'react';
import about from '../info/about.json';

const Sidebar = () => {
    const info = {
        name: 'Arnab Roy',
        email: about.About.find(item => item.section.includes('email')).description,
        bio: about.About.find(item => item.section.includes('side-bio')).description
    };

    return (
        <div>
        <div>
          <nav href="#navbar" className="js-template-nav-toggle template-nav-toggle" data-toggle="collapse" data-target="#navbar" aria-expanded="false" aria-controls="navbar"><i /></nav>
          <aside id="template-aside" className="border js-fullheight">
            <div className="text-center">
              <div className="author-img" style={{backgroundImage: 'url(images/about.jpg)'}} />
                <h1 id="template-logo"><a href="index.html">{info.name}</a></h1>
              <div className="short-bio">{info.bio}</div>
              <span className="email"><i className="icon-mail"></i> <a href={`mailto:${info.email}`}>{info.email}</a></span>
            </div>
            <nav id="template-main-menu" role="navigation" className="navbar">
              <div id="navbar" className="collapse">
                <ul>
                  <li className="active"><a href="#home" data-nav-section="home">Home</a></li>
                  <li><a href="#about" data-nav-section="about">About</a></li>
                  <li><a href="#" data-nav-section="experience">Experience</a></li>
                  <li><a href="#" data-nav-section="skills">Skills</a></li>
                  {/* <li><a href="#" data-nav-section="projects">Projects</a></li> */}
                  <li><a href="#" data-nav-section="education">Education</a></li>
                  <li><a href="#" data-nav-section="contact">Contact</a></li>
                  {/* <li><a href="#" data-nav-section="blog">Blog</a></li> */}
                </ul>
              </div>
            </nav>
            <nav id="template-main-menu">
              <ul>
                <li><a href="https://www.linkedin.com/in/arnab-roy-600403a1/" target="_blank" rel="noopener noreferrer"><i className="icon-linkedin2" />LinkedIn</a></li>
                <li><a href="https://github.com/trifiasco" target="_blank" rel="noopener noreferrer"><i className="icon-github"/>Github</a></li>
                <li><a href="https://stackoverflow.com/users/9041122/arnab-roy" target="_blank" rel="noopener noreferrer"><i className="icon-stackoverflow" />Stackoverflow</a></li>
              </ul>
            </nav>
          </aside>
        </div>
      </div>

    );
}

export default Sidebar;