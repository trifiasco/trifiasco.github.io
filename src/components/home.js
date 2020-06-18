import React, {useState} from 'react';
import FullPageDialog from './utils/fullPageDialog';

const Home = () => {
    const resumePath = `${process.env.PUBLIC_URL}/static files/Arnab_Roy_Resume.pdf`;

    return (
        <div>
        <section id="template-hero" className="js-fullheight" data-section="home">
          <div className="flexslider js-fullheight">
            <ul className="slides">
              <li style={{backgroundImage: 'url(images/img_bg.jpg)'}}>
                <div className="overlay" />
                <div className="container-fluid">
                  <div className="row">
                    <div className="col-md-6 col-md-offset-3 col-md-pull-3 col-sm-12 col-xs-12 js-fullheight slider-text">
                      <div className="slider-text-inner js-fullheight">
                        <div className="desc">
                          <h1>Hi! <br />I'm Arnab</h1>
                          <FullPageDialog />
                          {/* <p><a className="btn btn-primary btn-learn" onClick={}  >View CV<i className="icon-download4" /></a></p> */}
                        </div>
                      </div>
                    </div>
                  </div>
                  {/* href="https://drive.google.com/open?id=1b1daoJn6eziuvpmKOcSCvQZn1qI2AXOo" target="_blank" rel="noopener noreferrer" */}
                  {/* <div id='viewer' style={{width: '100%', height:'100%'}}>
                    <object width="100%" height="400" data={resumePath} type="application/pdf">   </object>
                  </div> */}
                </div>
              </li>
              <li style={{backgroundImage: 'url(images/img_bg.jpg)'}}>
                <div className="overlay" />
                <div className="container-fluid">
                  <div className="row">
                    <div className="col-md-6 col-md-offset-3 col-md-pull-3 col-sm-12 col-xs-12 js-fullheight slider-text">
                      <div className="slider-text-inner">
                        <div className="desc">
                          <h1>I love building<br /> THINGS !!</h1>
                          <p><a className="btn btn-primary btn-learn" href="https://github.com/trifiasco" target="_blank" rel="noopener noreferrer">View Projects <i className="icon-briefcase3" /></a></p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </li>
              <li style={{backgroundImage: 'url(images/img_bg.jpg)'}}>
                <div className="overlay" />
                <div className="container-fluid">
                  <div className="row">
                    <div className="col-md-6 col-md-offset-3 col-md-pull-3 col-sm-12 col-xs-12 js-fullheight slider-text">
                      <div className="slider-text-inner">
                        <div className="desc">
                          <h1>I often <br/>Write ... </h1>
                          <p><a className="btn btn-primary btn-learn" href="https://trifiasco.blogspot.com/" target="_blank" rel="noopener noreferrer">View Blog <i className="icon-book" /></a></p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </li>
            </ul>
          </div>
        </section>
      </div>
    );
};

export default Home;