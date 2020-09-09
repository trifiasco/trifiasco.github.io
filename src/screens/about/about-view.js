import React from "react";
import DevIcon from "devicon-react-svg";
import about from "../../info/about.json";
import skills from "../../info/skills.json";
import SimpleIcons from "simple-icons-react-component";
import getIcons from "../../components/utils/icons";

const devIconStyle = {
  fill: "thistle",
  width: "150px",
};

const About = () => {
  return (
    <div>
      <section className="template-about" data-section="about">
        <div className="template-narrow-content">
          <div className="row">
            <div className="col-md-12">
              <div
                className="row row-bottom-padded-sm animate-box"
                data-animate-effect="fadeInLeft"
              >
                <div className="col-md-12">
                  <div className="about-desc">
                    <span className="heading-meta">About</span>
                    <h2 className="template-heading">Who Am I?</h2>
                    {about.About.map((section) => {
                      if (section.section.includes("side")) {
                        return;
                      }
                      return section.description.map((entry) => {
                        return (
                          <p
                            className="about"
                            dangerouslySetInnerHTML={{ __html: entry }}
                          ></p>
                        );
                      });
                    })}
                  </div>
                  <div className="heading-meta">
                    <p style={{ fontWeight: "1000", fontSize: "15px" }}>
                      Tech I have worked with:
                    </p>
                  </div>
                  <div className="tech-stack">
                    <div>
                      <div className="heading-meta">languages</div>
                      {getIcons("javascript")}
                      {getIcons("python")}
                      {getIcons("cpp")}
                      {getIcons("graphql")}
                      {/* {getIcons("sql")} */}
                    </div>
                    <div>
                      <div className="heading-meta">Web Technlogies</div>
                      {getIcons("nodejs")}
                      {getIcons("react")}
                      {/* {getIcons("apollo")} */}
                      {getIcons("django")}
                    </div>
                    <div>
                      <div className="heading-meta">Cloud</div>
                      {getIcons("aws")}
                    </div>
                    <div>
                      <div className="heading-meta">Tools</div>
                      {getIcons("git")}
                      {getIcons("docker")}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default About;
