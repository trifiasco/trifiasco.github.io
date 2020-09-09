import React from "react";
import Particles from "react-particles-js";

const ParticlesBG = (props) => {
  return (
    <Particles
      params={{
        particles: {
          color: {
            value: "#000000",
          },
          line_linked: {
            color: {
              value: "#000000",
            },
          },
          number: {
            value: 50,
          },
          size: {
            value: 3,
          },
        },
        interactivity: {
          events: {
            onhover: {
              enable: true,
              mode: "repulse",
            },
          },
        },
      }}
    />
  );
};

export default ParticlesBG;
