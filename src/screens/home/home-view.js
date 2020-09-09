import React from "react";
import ParticlesBG from "../../components/particles-view";
import Resume from "../../info/trifiasco-resume.pdf";

const Home = () => {
  return (
    <div>
      <section id="template-hero" className="js-fullheight" data-section="home">
        <div className="flexslider js-fullheight">
          <ul className="slides">
            <ParticlesBG />
            <li style={{ backgroundImage: "url(images/about1.jpg)" }}>
              <div className="overlay" />
              <div className="container-fluid">
                <div className="row">
                  <div className="col-md-6 col-md-offset-3 col-md-pull-3 col-sm-12 col-xs-12 js-fullheight slider-text">
                    <div className="slider-text-inner js-fullheight">
                      <div className="desc">
                        <h1>
                          Hi! <br />
                          I'm Arnab
                        </h1>
                        <p>
                          <a
                            className="btn btn-primary btn-learn"
                            href={Resume}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            View Resume <i className="icon-document" />
                          </a>
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </li>
            <li style={{ backgroundImage: "url(images/img_bg.jpg)" }}>
              <div className="overlay" />
              <div className="container-fluid">
                <div className="row">
                  <div className="col-md-6 col-md-offset-3 col-md-pull-3 col-sm-12 col-xs-12 js-fullheight slider-text">
                    <div className="slider-text-inner">
                      <div className="desc">
                        <h1>
                          I love building
                          <br /> THINGS !!
                        </h1>
                        <p>
                          <a
                            className="btn btn-primary btn-learn"
                            href="https://github.com/trifiasco"
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            View Projects <i className="icon-briefcase3" />
                          </a>
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </li>
            <li style={{ backgroundImage: "url(images/img_bg.jpg)" }}>
              <div className="overlay" />
              <div className="container-fluid">
                <div className="row">
                  <div className="col-md-6 col-md-offset-3 col-md-pull-3 col-sm-12 col-xs-12 js-fullheight slider-text">
                    <div className="slider-text-inner">
                      <div className="desc">
                        <h1>
                          I often <br />
                          Write ...{" "}
                        </h1>
                        <p>
                          <a
                            className="btn btn-primary btn-learn"
                            href="https://trifiasco.wordpress.com/"
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            View Blog <i className="icon-book" />
                          </a>
                        </p>
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

// {
//   "section": "current work",
//   "description": [
//     "Currently I am working at Craftsmen Ltd, a startup, as a Software Development Engineer. My responsibilities involves fullstack software development. I work on a web application which is a digitized newsroom platform. I developed multiple application wide features."
//   ]
// },
// {
//   "section": "background",
//   "description": [
//     "I completed my B.Sc in Computer Science and Engineering from Military Institute of Science & Technology(MIST). While doing so I was mostly into Competitive programming and Problem solving. I have solved around 800 programming problems using several data-structures and algorithms in different online judges. Also I participated in several online and onsite national programming contests including two ACM-ICPC regionals. I also built several projects as a student."
//   ]
// }
