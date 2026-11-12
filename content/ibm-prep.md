# IBM interview prep: Associate Cybersecurity Specialist

Interview is Monday, Nov 16. This page is the only thing you need to study from. Everything else on the site can wait.

**Rule one: don't fake anything.** You don't need to sound like an expert. IBM's own entry-level posting for this kind of role says it "is not about being a security expert on day one." They want someone who learns fast, works in a team and can explain what they actually did. Say "I haven't done that, but here's how I'd approach it" without apologizing. That lands better than a bluff, and bluffs fall apart on the first follow-up.

Anything in **[[brackets]]** is a fact only you know. Fill it in or delete the sentence. Don't invent numbers.

## The 4-day plan

About 90 minutes a day. Say answers out loud. Reading them silently doesn't count.

**Thu (today): lock down your facts**
- Answer the questions at the bottom of this page (the "gaps" list) and fill in every [[bracket]].
- Read your own write-ups once: [homelab post](posts/proxmox-homelab.html), [HiTek post](posts/hitek-forensics.html), [finance share post](posts/finance-share-access-denied.html), [anti-VM post](posts/anti-vm-patching.html).
- Open your lab and take 10 minutes to click around. See "Honest handling of 'I stopped using it'" below.

**Fri: the homelab**
- Read the homelab cheat sheet below until you can draw the network on paper without looking.
- Look at [~/homelab](homelab.html) and [attack-chain](attack-chain.html) so your explanation matches what's published.
- Do the questions in [~/interview/homelab](interview/homelab.html) out loud.
- Skim the [Security Onion guide](learn/siem-security-onion.html) and [pfSense guide](learn/firewalls-pfsense.html) for vocabulary.

**Sat: past job, forensics and the STAR bank**
- Read the STAR answers below. Rewrite each one in your own words, shorter. Then say each one out loud twice.
- Do [~/interview/work](interview/work.html) and [~/interview/forensics](interview/forensics.html).
- Skim [interview basics](careers/interview.html) for "tell me about yourself" and "do you have questions for us".

**Sun: security basics and a dry run**
- Re-read [incident response](learn/incident-response.html) and [log analysis](learn/log-analysis.html). Know the IR phases (preparation, detection and analysis, containment, eradication, recovery, lessons learned) and the CIA triad.
- Use [~/start](start.html) only if you need a refresher on a term. Don't open new topics.
- Do a full mock run: record yourself on your phone answering 6 questions in a row. Watch it once. Fix the one thing that bugs you.
- Check your setup (camera, link, directions), pick your clothes, sleep.

**Monday morning:** read the one-page cheat sheet at the bottom. Nothing new.

**Ignore until after Monday:** arcade, dojo, ~/code, ~/cloud, ~/ai, ~/history, the 50 guides, the flashcards, the curriculum plan, ~/jobs, ~/bullets. All good stuff, none of it moves Monday.

## What IBM probably cares about

I checked two IBM postings for this kind of role. I don't have your actual posting, so check yours for anything different. If you have it, paste it to me and I'll tailor this.

- **Entry-level IBM Consulting security role (an expired Baton Rouge posting I found, so yours may differ):** supporting security engagements with senior consultants, monitoring and analyzing threats and vulnerabilities, helping implement security controls and tools, security operations and incident support, and integrating security tools into client environments. They asked for network and security fundamentals (authentication and authorization, encryption, network design), exposure to at least one cyber area through labs or projects, some scripting (Python, Java, C, Bash), and familiarity with tools like vulnerability scanners, firewalls, IDS/IPS and packet analysis. SOC and incident response exposure was a plus, and so was "familiarity with generative AI concepts."
- **IBM managed security services (MSS) entry role (a different posting, another country):** first-line triage of SIEM alerts, identify, analyze, action, validating IPs, ports, files, hashes and usernames, escalating to a level 2 analyst, and writing tuning requests when rules are noisy.
- **Values:** teamwork, willingness to learn and take feedback, client focus, and "trust and personal responsibility." IBM's stated culture themes include client success and innovation that matters.

**What that means for you:** your homelab (firewall, SIEM, AD, segmentation) matches the tools list almost line for line. Your forensics project is "incident support." Your AI Trainer job covers the generative AI line. Your laptop job shows process and reliability. You're a good fit on paper. The interview is about showing that you understand it, not just that you built it.

**Likely themes:** why security, why IBM, tell me about a project, walk me through an alert or incident, how you'd learn a tool you've never seen, how you work in a team, how you handle pressure or a mistake, and some fundamentals (CIA, phishing response, what a SIEM does, TCP/IP basics, firewall rules).

## STAR in 30 seconds

**S**ituation (one sentence), **T**ask (what was yours), **A**ction (what *you* did, this is the longest part), **R**esult (what happened, what you learned). Aim for 60 to 90 seconds. Say "I", not "we", unless it was a team. If it was a team, say what your part was.

## The STAR bank

These are drafts built only from what's in your resume, your repos and your write-ups. The details I don't know are marked. Put them in your own words. If an answer doesn't sound like you saying it, change it.

### 1. Tell me about yourself
I just finished my CS degree at LSU with a cybersecurity concentration. What I like most is the defensive side: watching network traffic, figuring out what happened after the fact, and understanding how malware behaves so I know what to look for. I built a seven-VM homelab on Proxmox with a firewall, an Active Directory domain and Security Onion so I could attack things and then look at what the defender sees. In school I did a forensics project where my team reconstructed a data exfiltration from disk images and a packet capture, and I reverse-engineered a RAT and a worm. Right now I work as a laptop technician doing secure data wiping and repairs, and I do AI training work on the side. I'm working toward Security+ and I'm looking for a role where I can learn from a real security team. That's why this one caught my eye.

### 2. Walk me through your homelab
See the cheat sheet below. Short version: "I wanted a place to practice attacking and defending something that looks like a company network. It runs on one box, [[i7-10900K, 64 GB, 2 TB: confirm]]. pfSense sits in the middle with default-deny rules and splits the network. Kali is the attacker. Metasploitable and DVWA/WebGoat are the targets. A Windows Server 2022 domain controller and a Windows 11 workstation make it look like a company. Security Onion watches a mirrored copy of the traffic. I connect remotely through Tailscale so nothing is exposed to the internet." Then stop and let them pick a thread.

### 3. A technical problem you troubleshot (homelab)
- **S:** Security Onion was running but showing no useful traffic from the lab.
- **T:** Get it to actually see the lab network, since monitoring is the point of the whole build.
- **A:** I [[confirm what you did, the repo says it was the mirror/span port: what you checked and what fixed it]]. I made sure the sniffing interface had no IP of its own so it only listens and doesn't change what it monitors, then confirmed Zeek and Suricata were logging lab traffic.
- **R:** [[what it showed once it worked]]. I learned that you can't defend what you can't see, and that getting the visibility right comes before writing any detections.

### 4. A help-desk style problem (finance share)
- **S:** In my IT support lab, a user could sign in and reach the Finance share, but got "access denied" when opening it.
- **T:** Work it like a real ticket and fix it properly.
- **A:** I reproduced it from the domain-joined workstation, checked the user's AD groups, and saw they were missing from the Finance-Share-Read group. I added them with PowerShell (`Add-ADGroupMember`), then had them sign out and back in, because group membership is baked into the access token at logon. I also remembered that share permissions and NTFS permissions both apply and the stricter one wins.
- **R:** Access worked after the new token. I documented it in the ticket. The lesson is to check the token and layered permissions before assuming the fix didn't work.

### 5. Incident response / investigation (HiTek forensics)
- **S:** In a team forensics challenge, we got a Windows disk image, an Ubuntu disk image and a PCAP, and had to find out how company data was stolen.
- **T:** [[your part: which image or tool did you own, and the report/presentation?]]
- **A:** I used FTK Imager and Autopsy on the images and Wireshark on the capture. We cracked six account passwords, carved deleted ZIP archives out of unallocated space, and lined up file activity on the machines with the outbound connections in the capture. That let us rebuild the exfil path from FTP to HTTP as one timeline.
- **R:** We delivered an investigative report and presentation on the evidence, the timeline and who did it. [[your grade or result if you want to mention it]]. It taught me to corroborate across at least two sources before saying something happened.

### 6. Tell me about a time you made a mistake
This one has to be real. Draft shape: "[[a real mistake: a wipe, a repair, a lab you broke, a missed deadline]]. I noticed when [[how]]. I told [[who]] right away, fixed it by [[what]], and now I [[the process change, like a checklist or a snapshot first]]." If nothing work-related comes to mind, a lab example is fine: breaking a VM or locking yourself out of a firewall rule, restoring from a Proxmox snapshot, and now taking snapshots before changes. Pick the honest one.

### 7. Conflict or disagreement
[[A real example. Group project disagreement about approach? A coworker? A customer?]] Shape: what you disagreed about, how you listened first, what you proposed, how it ended. Don't pick a story where you were simply right and they were wrong. If you honestly don't have a conflict, say so and give the closest thing, like a group project where you disagreed on scope and settled it by [[how]].

### 8. Teamwork
HiTek was a team. "[[Our team split the work like this and my part was X]]. When someone else was stuck on [[Y]], I [[helped how]]. We pulled it together into one timeline and one presentation." Use it for "how do you handle working with others". Also used for Room'r and ERU if you want a software team example: [[your part of those]].

### 9. Learning something new fast
Reverse engineering is the best one. "In the malware course I'd never read assembly. I had to [[how you learned: lab work, practice, Ghidra]]. A sample I analyzed used SIDT, SLDT and STR to detect a VM and refused to run. I learned how those instructions return descriptor-table locations, found the comparison in IDA and Ghidra, and patched the jump so it took the 'real hardware' path." Result: you could run it in your analysis VM. This also shows you can go from reading to doing. Alternatively: how you taught yourself Proxmox/pfSense/Security Onion for the lab.

### 10. Working under pressure / handling a deadline
[[A real deadline: final project week, work rush, two classes at once]]. Shape: what was due, how you prioritized, what you did first, how it turned out. Laptop job version: [[a busy stretch with a pile of units to wipe and ship]].

### 11. Attention to detail (laptop job)
"As a laptop technician I wipe drives before resale using XErase and EPSBoot. A skipped or failed wipe means someone's data could leak, so I [[how you verify: check the report, confirm the drive shows wiped, log serials]]. I also reduced turnaround time by [[what you actually changed]]." Don't mention the employer's confidential details. Mention NIST SP 800-88 only if you know it.

### 12. Using initiative
The homelab is the answer: nobody assigned it. "I wanted hands-on experience beyond coursework, so I built a company-style network myself, wrote it up on my site, and put the notes on GitHub." Then keep it short, the trap is rambling.

### 13. Explaining something technical to a non-technical person
"[[A real time, maybe in the laptop job explaining a problem to a customer or coworker, or in the HiTek presentation]]." Fallback: the forensics report, where you put the summary and impact first and the technical details after.

### 14. Prioritizing multiple tasks
"If I had a server outage and an executive's request, I'd handle the outage first because more people are affected, and send the executive a quick note with a realistic time." Pair it with a real example from [[the laptop job or school]].

### 15. Handling something you didn't know
"I'd say I don't know yet, then tell them how I'd find out: check the docs, search the logs, ask a senior person, and write down what I learned." Back it up with an example: [[a time you hit something unfamiliar in the lab]]. IBM's posting stresses taking feedback and learning, so lean in.

### 16. Why cybersecurity?
[[In your own words, the real reason. Keep it to 3 sentences.]] Prompt: what hooked you first, and what keeps you going (the malware labs? seeing a scan show up in Security Onion?). Don't say "I love hacking" without a specific moment.

### 17. Why IBM?
Be specific and honest. Points you can use: IBM is a large company with real client work, so you'd see many environments and tools, which suits someone early in their career. The role includes training and mentoring with senior people, which is how you want to learn. They run security operations for clients, which is the thing you've been practicing. [[Add one thing you actually looked up about IBM that you liked: a product, X-Force research, a report. Look at ibm.com/security for 10 minutes and pick one real thing.]] Don't recite the mission statement.

### 18. Where do you see yourself in 3 to 5 years?
"Getting solid as a SOC or security operations analyst, earning Security+ and then something like CySA+, and moving toward [[incident response, threat hunting, or detection engineering: pick what is true]]." Say you want to grow with the team.

### 19. Why should we hire you?
"I already work the way this job works: I build and test things, I look at logs and traffic to understand what happened, and I document it. I'm early in my career, but I'm reliable, I learn fast on my own, and I'm easy to coach."

### 20. Weaknesses
Real one, with a fix. Example shape: "[[something true: I get stuck on a problem too long before asking for help]], so now I set a time limit and ask." Don't use "I'm a perfectionist."

## Homelab "yap" cheat sheet

Everything here comes from your homelab repo and write-ups. Items marked [[confirm]] are things I couldn't see.

**The one-line goal:** a safe place to practice attacking and defending something that looks like a company network, with offense and defense side by side.

**Hardware:** one box, [[i7-10900K, 64 GB RAM, 2 TB SSD: confirm]], running Proxmox VE.

**Architecture (draw this):**
- Proxmox host with virtual bridges: one for the upstream path, one for the lab.
- **pfSense:** router and firewall between upstream and the lab. Does routing, DHCP, DNS, NAT. Rules are default-deny; vulnerable boxes get no internet. Only allowed where an exercise needs it.
- **Attack side:** Kali, plus Metasploitable 2 and DVWA/WebGoat in Docker on an Ubuntu box as targets.
- **Company side:** Windows Server 2022 domain controller (lab.local, OUs, users, groups) and a domain-joined Windows 11 workstation.
- **Monitoring:** Security Onion on a mirrored (span) port with a sniffing interface that has no IP of its own, running Zeek and Suricata. Mirroring means monitoring doesn't change what it watches.
- **Remote access:** Tailscale with subnet routing. No ports forwarded to the internet.
- **Support lab:** a second lab with an osTicket help desk on Ubuntu (Apache, PHP, MariaDB) used for working realistic tickets against the AD domain.

**What you built, in order:** Proxmox and bridges, pfSense and rules, the DC and domain, workstation join, Ubuntu with DVWA/WebGoat, Kali and Metasploitable, then Security Onion.

**What you learned (your own write-up says):** segmentation is the feature; you can't defend what you can't see; document and sanitize as you go.

**What broke:** [[tell me. Mirror port / no traffic in Security Onion? Anything with pfSense rules, DHCP, AD join, Tailscale routes? Add 2 real stories.]]

**What you'd improve (pick two you'd really do):** collect Windows event logs into the SIEM, build templates or automation so you can rebuild quickly, write the firewall rules down before building, add baselines, and write real attack-and-detection walkthroughs with evidence from real runs.

**Security hardening to be ready for:** default-deny, vulnerable VMs isolated with no internet, no inbound ports (Tailscale only), snapshots before attacks, MFA on the Tailscale account, unique passwords in a password manager, SSH keys, patching the Proxmox host. **Before Monday, make sure the real lab matches what you say.** If you reuse passwords on the lab or skipped MFA, fix that this week and then you can say "I hardened it." Only claim what's true.

**Likely follow-ups and short answers:**
- *What's the difference between IDS and IPS?* IDS detects and alerts; IPS can also block inline.
- *Zeek vs Suricata?* Suricata matches signatures and gives alerts; Zeek writes structured logs of what happened (connections, DNS, HTTP).
- *What does the span port do?* Copies traffic so the sensor can analyze without sitting in the path.
- *How does pfSense default-deny work?* No rule, no traffic. Rules are checked top to bottom per interface.
- *What is NAT / DHCP?* NAT translates private addresses to the outside address; DHCP hands out addresses.
- *What does Tailscale subnet routing do?* A node advertises the lab subnet to your private tailnet so approved devices can reach it without opening ports.
- *What would a real attacker do first?* Recon (scan), then find a weak service, then credentials and lateral movement. Say which stages you've actually tested.
- *What did Security Onion detect and miss?* [[a real example, or say honestly what you've seen and what you want to test next. The site's attack chain is a scripted scenario, so don't claim detections you haven't seen.]]

### Honest handling of "I built it then stopped using it"

If they ask, don't hide it and don't over-explain. Something like:

"I built it during school and used it heavily for [[projects/classes]]. Since then I've been busy with finishing my degree and work, so I haven't run new scenarios as much. I [[turned it back on this week]] and I'm planning to [[specific next exercise, e.g., run a Kali scan and find it in Security Onion, or forward Windows logs into the SIEM]]." The best version of this answer is one where it's true, so spend 30 to 60 minutes this weekend actually booting it and doing one small thing, like a scan from Kali and finding it in Security Onion. Then you can say what you saw, which beats any rehearsed line.

## Past job: laptop technician (quick notes)

Facts from your resume: secure data sanitization (XErase, EPSBoot) before resale, diagnosing and repairing hardware and software on many laptop models, installing Windows, drivers and software, reduced device-to-resale turnaround. Started June 2025.
Gaps to fill: [[laptops per week or day]], [[what exactly cut turnaround time]], [[a hard repair you solved]], [[how you verify a wipe]].
Be ready for: "what do you do when a laptop won't boot?" (power and charger, lights and beeps, reseat RAM and drive, test known-good parts, check BIOS sees the drive, boot from external media).

## IBM questions for you to ask

Pick 3 or 4. Write them down. Asking nothing is a mistake.
1. What does a typical first 90 days look like for someone in this role?
2. Who would I be working with day to day, and how does mentoring work with senior people?
3. What tools and platforms would I use most (SIEM, EDR, ticketing)? What should I learn first?
4. How does the team handle escalation and learning from incidents?
5. Is the work more client-facing, internal, or a mix, and is it onsite, remote or hybrid?
6. What does success look like at six months?
7. What training or certifications does IBM support for people in this role?
8. What do you like most about working on this team?

## Questions to answer for me (the gaps)

Reply in the thread with quick, rough answers. I'll turn them into polished, in-your-voice STAR answers.
1. Which role are you interviewing for exactly (team, onsite/remote, link to the posting)? Who's interviewing: a recruiter, a manager, a technical panel?
2. Homelab: what's one thing that broke and how did you fix it? Did you ever run an attack and see it in Security Onion? What did it catch and miss?
3. Is the lab still working? Are your passwords and MFA fine? (Just yes/no, not the passwords.)
4. HiTek: what was your personal part? What was the result?
5. Laptop job: roughly how many laptops, and what did you change that cut turnaround?
6. A real mistake you made and what you changed after.
7. A real disagreement with a teammate, coworker or customer.
8. Why cybersecurity and why IBM, in your own rough words.

## Monday morning cheat sheet

- **Open with:** CS grad, cyber concentration, built a seven-VM homelab, forensics project, work in laptop security. Looking to learn from a real team.
- **Homelab in one breath:** Proxmox, pfSense segmentation with default-deny, Kali plus vulnerable targets, Windows AD domain, Security Onion on a mirror port, Tailscale for access.
- **Three stories ready:** the finance share ticket, the HiTek exfil timeline, the anti-VM patch.
- **If you don't know:** "I haven't done that, here's how I'd approach it."
- **Ask 3 questions at the end.**
- **Breathe, slow down, pause before answering.** Dry and calm is a good look.
