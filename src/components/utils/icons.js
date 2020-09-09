import React from "react";
import { IconContext } from "react-icons";
import { FaPython } from "react-icons/fa";
import {
  SiCplusplus,
  SiJavascript,
  SiGraphql,
  SiNodeDotJs,
  SiDjango,
  SiReact,
  SiApollographql,
  SiAmazonaws,
  SiGit,
  SiDocker,
} from "react-icons/si";
import { DiDatabase } from "react-icons/di";

const wrapper = (IconComponent, name) => {
  return (
    <IconContext.Provider
      value={{
        size: "5em",
        title: name,
        style: { paddingLeft: "5px", paddingRight: "5px" },
      }}
    >
      <span>
        <IconComponent />
      </span>
    </IconContext.Provider>
  );
};

const icons = {
  javascript: wrapper(SiJavascript, "javascript"),
  python: wrapper(FaPython, "python"),
  cpp: wrapper(SiCplusplus, "c++"),
  graphql: wrapper(SiGraphql, "graphQL"),
  nodejs: wrapper(SiNodeDotJs, "node.js"),
  django: wrapper(SiDjango, "django"),
  react: wrapper(SiReact, "react"),
  apollo: wrapper(SiApollographql, "apollo"),
  aws: wrapper(SiAmazonaws, "aws"),
  git: wrapper(SiGit, "git"),
  docker: wrapper(SiDocker, "docker"),
  sql: wrapper(DiDatabase, "sql"),
};

const getIcons = (name) => {
  return icons[name];
};

export default getIcons;
