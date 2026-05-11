I got it. Let me organize what you described into a clean spec so we're aligned before any code.

Reward Config System — "Gold Economy Settings"
Location: SuperAdmin panel, global (applies to all schools) KV key: realm_reward_config (single global object)

Part A: Activity Reward Table
Six activities, each with base rewards + daily cap toggle:
Activity
Gold
XP
Daily Limit?
Complete a Test
Based on part B
Based on part B
yes/no toggle
Complete a Practice
Based on part B
Based on part B
yes/no toggle
Flash Card session
configurable
configurable
yes/no toggle
Watch a Video
configurable
configurable
yes/no toggle
Listen to Music
configurable
configurable
yes/no toggle
Battle with Friends
configurable
configurable
yes/no toggle


"Daily Limit = Yes" means: student earns the base reward once per day per activity type.
They can still do it again, but no gold/XP on repeat that same day.
"Daily Limit = No" means full gold on replays across days — no diminishing returns ever.













Part B: Score Bonus Table (Test & Practice only)
Students choose which age level to attempt (not locked to their real age). Higher age = harder questions = bigger bonus. This is the incentive to push themselves (Please include XP side by side along with the Gold Setting  )
The admin sets bonus gold per age level x per accuracy tier:
Age Level
>80% Bonus Gold/XP
>90% Bonus Gold/XP
100% Bonus Gold/XP
Age 4
X
X
X
Age 5
X
X
X
Age 6
X
X
X
Age 7
X
X
X
Age 8
X
X
X
Age 9
X
X
X
Age 10
X
X
X
Age 11
X
X
X
Age 12
X
X
X



Part C: Age Selection UX (in Test & Practice modes)
Before starting a test/practice, the student sees an age selector screen:
Shows ages 4–12 as selectable levels (RPG-style difficulty tiers)
Their actual age is highlighted/recommended
Higher ages glow with bigger gold icons to show the reward incentive
Questions are pulled from fetchQuestionBank({ age_target: selectedAge })









Full Rename Plan
Old
New
Notes
RealmQuestPage.tsx
RealmTestPage.tsx
Component + file rename
/realm/quest route
/realm/test route
URL change
"Quest Board" UI text
"Test Board"
All user-facing labels
"Quest Complete!"
"Test Complete!"
Loot screen
fetchLiveQuests()
stays (backend unchanged for now)
Just rename UI labels
"Quest" concept
Reserved for future Pokemon-style quests
Separate feature later




Questions before I build:
Score bonuses — Gold only or Gold + XP? You mentioned bonus gold per tier. Should XP also get age-scaled bonuses, or is XP flat from base only?
Please include XP side by side along with the Gold Setting 


Daily limit tracking — When "Daily Limit = Yes", does that mean the student gets base gold once that day but can still earn score bonuses on replays? Or is EVERYTHING capped (base + bonus) to one payout per day?
Cap Gold - but add experience 


Flash Card / Video / Music — These are future activities right? Or do some already exist in the realm? (I know the video system exists in the app but not sure if it's wired into the realm gold economy yet)
It is already working with contents please check 


Battle with Friends — Also future? Just want to know if I should stub it in the config UI now or leave it for later.
Its now -but let us come back to this later -  just add a scan QR code screen for now 



Default values — Want me to set sensible defaults (e.g. Age 4 = 10/20/50 bonus gold, Age 12 = 100/200/500) so the system works out of the box, and SuperAdmin tweaks from there?
YES PLS. 

Additional rules:
• Part B (Side-by-Side XP): make sure the UI shows a "Potential Loot" preview before they start. Seeing "+500 XP / +200 Gold" in big, shiny text is what makes them click "Start."  
• Part C (The Recommendation): The age selector : Highlight their actual age. This gives them a "Safe Zone" while the higher ages act as the "Challenge Zone."  
• The "Daily Limit" Toggle: if you are doing the sample data for me ,Make sure "Daily Limit = No" is the default for Videos and Music. We want them to consume as much educational content as possible without being penalized.  



