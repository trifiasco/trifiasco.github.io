import React from 'react';
import achievements from '../info/achievements.json';

const Achievements = () => {
    return (
        <div>
        <section className="template-achievements" data-section="achievements">
        <div className="template-narrow-content">
            <div className="row">
            <div className="col-md-12">
                <div className="row row-bottom-padded-sm animate-box" data-animate-effect="fadeInLeft">
                <div className="col-md-12">
                    <div className="about-desc">
                    <span className="heading-meta">Achievements</span>
                    <h2 className="template-heading">Honors &amp; Awards</h2>
                    {achievements.Achievements.map(item => {
                        return (
                            <div>
                                <li className="awards" dangerouslySetInnerHTML={{__html: item.Description}}></li>
                                {item.images.map(img => {
                                    return (
                                        <img alt="awards" style={{height: '50vh', width: '50vh', marginLeft: '20px', marginRight: '20px', marginBottom: '20px'}} src={`${process.env.PUBLIC_URL}/images/achievements/${img}`}/>
                                    )
                                })}
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
      </div>
    );
};

export default Achievements;