---
title: "Storytelling with Data"
date: 2026-01-31T19:51:35+01:00
draft: false
slug: "storytelling-with-data"
tags: ["storytelling", "data visualization", "communication"]
categories: ["Data Science", "Communication"]
description: "Techniques and best practices for effectively communicating data through storytelling."
toc: true
---

I recently worked on adding outlier detection in a data pipeline. As a person primarily focused on backend and infra work, I thought this would be a good opportunity to brush up my statistics knowledge and learn some sophisticated outlier detection algorithms. Even though I did learn a few things along that line, I ended up learning something far more valuable. This article aims to compile my learnings on the subtle art of storytelling with data.


Whether you are a data scientist or a researcher or a developer, this applies to everyone. When preparing visuals to present in a slide deck or writing a technical documentation or even a research paper, **it's far more important to tell a story with whatever you are trying to convey. A compelling narrative is more effective than just facts in terms of getting your message across.**


This article will be broadly divided into two major sections. Part one is about storytelling as a powerful communication technique, and the second part would be around how to effectively do that with data and visualization.

> Most of the learnings came from this amazing book [storytelling with data](https://www.storytellingwithdata.com/books) by Cole Nussbaumer Knaflic. I highly recommend it.


## Part 1: Storytelling

Stories are one of the most powerful medium of communication. People remember compelling stories. Fact retention is effectively amplified with a supporting narrative attached to them.


### Structure
A compelling story must have a structure. A coherent and logical flow that the audience can follow.

A typical story will have three acts:
- the first act sets up the story by introducing characters, the relationships between them, the world they live in. This is also when a meaningful stake is established. Typically introducing a dramatic incident along which the characters will have to (re)act.

- the second act makes up the bulk of the story revolving around the characters attempt to solve the problem introduced in act one, going through changes as a result of what's happening (character development).

- the third act resolves the story with a climax where tensions are at the highest point. This is where the dramatic question introduced in the first act is answered and concluding the character development for the major character(s).


This is a tried and tested storytelling approach and works quite well. But this doesn't have to be rigid. There are other effective structures as well:

- **Problem, Solution, CTA**: This is a very common variant and very popular in sales world. You introduce a problem with meaningful stake (first act), then you provide a solution (whatever you are trying to sell) and explain how that thing solves the problem (second act), and finally you ask for a call to action (CTA) to buy whatever you are trying to sell.

- **What, So what, Now what**: This is my favorite. I have successfully employed this in various situations ranging from architectural discussions to impromptu public speaking.
    - ***what***: This is your stance on a topic. For example, you were asked to evaluate a design decision. The "what" is where you state your stance.
    - ***so what***: This is where you explain your stance, provide reasonings, explain why you think what you think and why should anyone care about what your stance is.
    - ***now what***: This is where you state the next steps, the call to action (CTA) and bringing it altogether by giving a concrete take-away that your audience can act (or think) upon.

    ***This is also very useful when you are thinking on your feet. It helps to keep your response concise and without ramblings.***

- **what if you could..,  so that.., for example.., and that's not all..**: This is a very common pitching technique.
    - you introduce something interesting with "what if you could do \<insert interesting thing\>"
    - you expand with listing some benefits "so that \<insert way(s) how that interesting thing could help the other person\>"
    - add specificity "for example \<insert a concrete example of the interesting thing would work\>"
    - bringing finality with "and that's not all, \<insert any additional benefits that the interesting thing could/would do\>"


You might notice all the variants are somewhat similar with congruence to the 3 acts storytelling. It depends on specific situation and which one you might want to employ. But with practice you can internalize the structures and will be able to employ the "right one" to the right situation.


### Audience
The second important thing to remember is **who is your audience, what do they care about, what do you want them to know**.

If you are presenting something to a tech-lead, the content and details will be very different from what you would have to present to an exec or a VP. The former would expect a lot of technical details, whereas the latter would expect impact and bottom line on the business outcome.

This requires you to think and curate the content differently. You might have to prepare different docs/slide deck for different audience segment focusing on what each segment would care about.

### Medium

The medium plays an important role here. Presenting live from a slide deck is very different from sending doc or an email on the same topic.

When you are presenting live, **you have a high level of control**. You can slow down and bring audience's attention to a specific thing that you want them to take a closer attention and speed up on the things that are tangential or supporting facts. In this medium you have the luxury of not having to add all the details as you are there to answer if and any questions that might arise.

But if you are sending documentation or an email, **you have very little control** how your audience might read it or where they would slow down or pay attention. You have to anticipate all the questions each reader might have. So you have to be very detailed, so that in case any questions arise, the documentation would have an answer.

**It's a good idea to provide a tl;dr or an executive summary in the beginning and details afterwards.** This provides a nice balance between what's most important first for people would skim and details for those who would care about details.

## Part 2: Effective data visualization

The second part of storytelling with data is all about how to effectively present data to bolster your message. This involves:

- *choosing the right visuals*
- *eliminating clutter from the visuals*
- *focusing audience's attention to the right place*

Everytime you present a chart/graph or any kind of visuals, you have to be very cautious about the **"perceived cognitive load"** of the audience. When you present a visual that has:

- too many elements whether it's data or labels.
- too many different concepts in one chart/graph.
- uncommon chart/graphs.

**The audience very quickly makes a subconscious decision whether it's too hard to perceive and potentially switch off**. So you want to make your visual as ***simple, clear, and to the point*** as possible, so that your audience's perceived cognitive load is minimal and you keep their attention on the thing you are trying to convey.

### Choosing the right visuals
It's important to choose the right type of visual for the thing you are trying to convey. Firstly you want to choose something that's common and familiar as much as possible.

For example, line and bar charts are very common and most people know how to interpret them. On the other hand waterfall or radar charts are not very common. So it would take more effort for an audience to interpret radar charts.

{{< figure-row >}}
{{< figure src="./fig1_radar_chart.png" alt="Model performance with radar chart" caption="Figure 1: Chart taking higher cognitive load to interpret" >}}
{{< figure src="./fig2_model_performace_with_bar_charts.png" alt="Model performance with bar chart" caption="Figure 2: Easy to interpret chart. One immediately sees where Model A stands in comparison to others." >}}
{{< /figure-row >}}

### Reduce clutter as much as possible

Each chart/graph should have a goal and a specific message or revelation. And you should ruthlessly declutter and keep only the necessary things that achieves that goal and convey that message.

For example, the following chart on the left shows latencies for 3 different regions per API. Whereas the chart on the right removes the region dimension. **The goal here is to show that a certain endpoint is slow**. Breaking down per region adds no additional value; it only adds noise and derails the focus.

{{< figure-row >}}
{{< figure src="./fig3_lack_clear_message.png" alt="Lack of clear messaging" caption="Figure 3: Lack of clear messaging and goal with unnecessary noise. Harder to pinpoint what's the take-away" >}}
{{< figure src="./fig4_clear_focused_message.png" alt="Focused and clear messaging" caption="Figure 4: Focused and clear messaging without extra information" >}}
{{< /figure-row >}}

### Text and annotation is your friend
You also need to be mindful about too much decluttering. Plain isn't always better. Sometimes adding annotation to highlight specific things is very important.

For example, **the text annotation on the right chart makes it very easy to interpret what happened and when.**

{{< figure-row >}}
{{< figure src="./fig11_too_simple_no_highlights.png" alt="Too simple ain't better" caption="Figure 5: Too decluttered, lacks messaging" >}}
{{< figure src="./fig12_annotation_is_good.png" alt="Annotation helps" caption="Figure 6: Annotation is your friend to clearly highlight cause and effects" >}}
{{< /figure-row >}}

### Use colors and contrast strategically

Our brains are wired to interpret colors and contrast differently. A bright color or large text immediately captures our attention. Use this to your advantage. Pinpoint specific parts where you want your audience's attention.

For example, **when you see the chart on the right, you immediately know where to focus.**

{{< figure-row >}}
{{< figure src="./fig5_lack_of_contrast.png" alt="Lack of contrast to grab attention" caption="Figure 7: Lack of contrast to grab attention" >}}

{{< figure src="./fig6_focus_attention_with_contrast.png" alt="Use of contrast to grab attention" caption="Figure 8: Use of contrast to grab attention" >}}
{{< /figure-row >}}

### Add context and references

Sometimes it's also a good idea to add a reference point with the use of colors and contrast. For example, illustrating latency could be put into perspective against SLA (service level agreements) to demonstrate how the system is performing.

Without a reference point, the chart lacks context. **It adds an implied call to action (CTA) that SLA is being violated and it requires attention.**
{{< figure src="./fig13_reference_point.png" alt="Reference point to put things in perspective" caption="Figure 9: Adding the SLA as a reference point to put the system performance into perspective" >}}


### Reduce friction between legends and data

You want to avoid too much back and forth between legends at the bottom and the data. Adding the legend next to the data would help your audience to quickly understand what's what.

For example, **the chart on the left requires you to constantly go back and forth between the legends at the bottom and the line charts** to understand which colored line means what. Whereas the chart on the right removes this back and forth. It's immediately known which line means what.

{{< figure-row >}}
{{< figure src="./fig7_legend_at_bottom.png" alt="Legend at bottom" caption="Figure 10: You have to go back and forth between data and legend to understand categories" >}}

{{< figure src="./fig8_direct_label.png" alt="Legend next to data" caption="Figure 11: Legend next to line immediately discerns categories" >}}
{{< /figure-row >}}

### Add an actionable title

Each chart should have an actionable title instead of a generic one. The title should answer the "So what?" by telling what's the meaning, the insight or simply a call to action (CTA).

{{< figure-row >}}
{{< figure src="./fig9_vague_title.png" alt="Vague chart title" caption="Figure 12: A vague title doesn't tell anything meaningful" >}}

{{< figure src="./fig10_actionable_title.png" alt="Actionable chart title" caption="Figure 13: An actionable title immediately delivers conclusion and a meaningful CTA" >}}
{{< /figure-row >}}

### Add a visual hierarchy

Ideally there should be a visual hierarchy to help users understand to which order to read the data. This is typically achieved by size, color, position and/or annotation. For example, larger marker can help drawing attention as well as encode a data dimension.

{{< figure-row >}}
{{< figure src="./fig14_lack_of_hierarchy.png" alt="Lack of visual hierarchy" caption="Figure 14: Lack of any hierarchy. Requires more effort to understand to which order to read the data" >}}

{{< figure src="./fig15_size_as_visual_hierarchy.png" alt="Use size as a visual order" caption="Figure 15: Using size to represent composite data dimension of reach and engagement. Could easily determine the impact of each feature" >}}
{{< /figure-row >}}

> These are my key take-aways and learnings. But there are a lot more nuances to these. You can (and should) checkout the book [storytelling with data](https://www.storytellingwithdata.com/books) for more details.


### Be mindful about narrative flow
It is very important to be mindful about the coherence and flow between different graphs/charts. Your visual elements and data should be in support of the story structure and narrative you decided to tell in the beginning. There should be a logical flow from one graph/charts to the next and each one should drive the story forward in a compact manner. You should be constantly asking does this support the narrative or just adds unnecessary noise.


## Recap

- Choose a structure for your story. Think about the narrative you want to deliver through data.
- Curate the content with the audience in mind. Focus on what you want them to know and what they would care about.
- Be mindful about the medium and amount of details different medium would demand.
- Choose the right visual, free up clutter, redirect focus and attention to where you want them.
- Provide context, meaningful title, and visual orders that helps convey the message.
- Maintain a coherent and logical flow between visual elements and the overall narrative. 


## Personal notes
- All the charts in this article are made with [plotly](https://plotly.com/python/). It's quite good and has good integration with jupyter and more importantly you can make interactive charts with it, which is quite cool.
- I deliberately chose different examples (data and/or charts) to illustrate different visualizing techniques rather than what the book has. I found it better for retention of knowledge as well as act as active learning rather than a passive one.
- The book was recommended by one of my colleagues. I couldn't thank him enough. It was a great read.
