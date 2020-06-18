import React, {useState} from 'react';
import about from '../info/about.json';

const About = () => {
    return (
        <div>
        <section className="template-about" data-section="about">
        <div className="template-narrow-content">
            <div className="row">
            <div className="col-md-12">
                <div className="row row-bottom-padded-sm animate-box" data-animate-effect="fadeInLeft">
                <div className="col-md-12">
                    <div className="about-desc">
                    <span className="heading-meta">About</span>
                    <h2 className="template-heading">Who Am I?</h2>
                    {about.About.map(section => {
                        if(section.section.includes('side')){return;}
                        return (
                            section.description.map(entry => {
                                return (
                                    <p>{entry}</p>
                                );
                            })
                        )
                    })}
                    <h2 className="template-heading">Achievements</h2>
                    {about.Achievements.map(item => {
                        return (
                            <div>
                                <li>{item.Description}</li>
                                {item.images.map(img => {
                                    return (
                                        <img style={{height: '150px', width: '150px'}} src={`${process.env.PUBLIC_URL}/images/achievements/${img}`}/>
                                    )
                                })}
                                {/* <img src={process.env.PUBLIC_URL + item.} */}
                            </div>
                            
                        )
                    })}
                    </div>
                </div>
                </div>
            </div>
            </div>
        </div>
        </section>
        {/* <section className="template-about">
        <div className="template-narrow-content">
            <div className="row">
            <div className="col-md-6 col-md-offset-3 col-md-pull-3 animate-box" data-animate-effect="fadeInLeft">
                <span className="heading-meta">What I do?</span>
                <h2 className="template-heading">Here are some of my expertise</h2>
            </div>
            </div>
            <div className="row row-pt-md">
            <div className="col-md-4 text-center animate-box">
                <div className="services color-1">
                <span className="icon">
                    <i className="icon-bulb" />
                </span>
                <div className="desc">
                    <h3>Web Development </h3>
                    <p>I have experience building web applications, micro-services using AWS, JavaScript, React, Node.js</p>
                </div>
                </div>
            </div>
            <div className="col-md-4 text-center animate-box">
                <div className="services color-3">
                <span className="icon">
                    <i className="icon-data" />
                </span>
                <div className="desc">
                    <h3>Data Structures & Algorithms</h3>
                    <p>As coming from the CS background, I have good grasp over fundamental concepts of DSA</p>
                </div>
                </div>
            </div>
            </div>
        </div>
        </section> */}
      </div>
    );
};

export default About;