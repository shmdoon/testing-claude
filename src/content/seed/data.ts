/**
 * Sample content: 2 courses for Class 7–8 using every block type, plus the
 * external tool registry. Compiled to supabase/seed.sql by `npm run db:seed:gen`.
 * IDs are fixed so seeding is idempotent.
 */
import type { Block } from "../blocks/schema.ts";

export type SeedTool = {
  id: string;
  slug: string;
  name: string;
  description: string;
  logo_url: string | null;
  base_url: string;
  submission_domains: string[];
  min_age: number;
  requires_account: boolean;
  enabled: boolean;
};

export type SeedLesson = {
  id: string;
  version_id: string;
  slug: string;
  title: string;
  summary: string;
  estimated_minutes: number;
  is_preview?: boolean;
  blocks: Block[];
};

export type SeedCourse = {
  id: string;
  slug: string;
  title: string;
  subtitle: string;
  description: string;
  outcomes: string[];
  course_type: "mini" | "big";
  class_levels: number[];
  subject: string;
  is_free: boolean;
  price_paise: number;
  cover_image_path: string | null;
  modules: { id: string; title: string; description: string; lessons: SeedLesson[] }[];
};

const u = (n: number) => `00000000-0000-4000-8000-${n.toString().padStart(12, "0")}`;

// ---------------------------------------------------------------------------
// External tools — verify each provider's minimum age in their current terms.
// ---------------------------------------------------------------------------
export const TOOL_IDS = { stitch: u(9001), aiStudio: u(9002), netlify: u(9003) };

export const tools: SeedTool[] = [
  {
    id: TOOL_IDS.stitch,
    slug: "google-stitch",
    name: "Google Stitch",
    description: "Design app screens from a text prompt.",
    logo_url: null,
    base_url: "https://stitch.withgoogle.com",
    submission_domains: [],
    min_age: 18,
    requires_account: true,
    enabled: true,
  },
  {
    id: TOOL_IDS.aiStudio,
    slug: "google-ai-studio",
    name: "Google AI Studio",
    description: "Try prompts with Google's Gemini models.",
    logo_url: null,
    base_url: "https://aistudio.google.com",
    submission_domains: [],
    min_age: 18,
    requires_account: true,
    enabled: true,
  },
  {
    id: TOOL_IDS.netlify,
    slug: "netlify",
    name: "Netlify Drop",
    description: "Publish a website by dragging a folder into the browser.",
    logo_url: null,
    base_url: "https://app.netlify.com/drop",
    submission_domains: ["*.netlify.app"],
    min_age: 13,
    requires_account: false,
    enabled: true,
  },
];

const quickQuiz = (
  id: string,
  questions: Extract<Block, { type: "quiz" }>["questions"],
): Extract<Block, { type: "quiz" }> => ({
  id,
  type: "quiz",
  phase: "check",
  title: "Quick check",
  passing_score: 60,
  questions,
});

const reflect = (id: string, prompt = "What did you notice? Write one or two sentences."): Block => ({
  id,
  type: "reflection_prompt",
  phase: "reflection",
  prompt,
  placeholder: "I noticed that…",
  min_chars: 20,
});

// ---------------------------------------------------------------------------
// Course 1 — mini, free
// ---------------------------------------------------------------------------
const whatIsAi: SeedCourse = {
  id: u(1),
  slug: "what-is-ai",
  title: "What is AI?",
  subtitle: "A 2-lesson taster: spot AI around you and see how machines learn from examples.",
  description:
    "Start here! In two short lessons you'll hunt for AI in everyday life and play the role of a computer learning from examples.",
  outcomes: [
    "Tell the difference between a normal program and an AI system",
    "Explain in your own words how a machine learns from examples",
    "Name three places you use AI every day",
  ],
  course_type: "mini",
  class_levels: [7, 8],
  subject: "ai",
  is_free: true,
  price_paise: 0,
  cover_image_path: "/seed/what-is-ai.svg",
  modules: [
    {
      id: u(101),
      title: "Lessons",
      description: "Two quick lessons.",
      lessons: [
        {
          id: u(1001),
          version_id: u(5001),
          slug: "spot-the-ai",
          title: "Spot the AI",
          summary: "Which of these everyday things use AI? Explore and find out.",
          estimated_minutes: 10,
          is_preview: true,
          blocks: [
            {
              id: "explore",
              type: "multiple_choice_explore",
              phase: "activity",
              prompt: "Tap each one. Which of these uses AI to decide what to do?",
              options: [
                { id: "calc", text: "A calculator adding 24 + 18", feedback: "No AI here — a calculator follows exact rules someone wrote. Same input, same answer, every time." },
                { id: "feed", text: "A video app choosing what to show you next", feedback: "Yes! It learned from millions of viewers what people like you tend to watch next." },
                { id: "fan", text: "A fan that turns on with a switch", feedback: "No AI — it's a simple circuit. On or off, nothing to learn." },
                { id: "photos", text: "A phone grouping photos by face", feedback: "Yes! It learned what faces look like from lots of examples." },
              ],
            },
            reflect("notice", "What did the AI examples have in common that the others didn't?"),
            {
              id: "concept",
              type: "rich_text",
              phase: "module",
              markdown:
                "## Rules vs. learning\n\nA **normal program** follows rules a person wrote: *if this, then that*.\n\nAn **AI system** works out its own rules by looking at **lots of examples** — like thousands of photos labelled \"cat\" or \"not cat\". That's why AI can handle messy things like faces, voices and handwriting.",
            },
            {
              id: "picture",
              type: "image",
              phase: "module",
              src: "/seed/rules-vs-learning.svg",
              alt: "Left: a person writing rules for a computer. Right: a computer looking at many labelled examples.",
              caption: "Rules are written by people. Patterns are learned from examples.",
            },
            {
              id: "fun",
              type: "callout",
              phase: "module",
              variant: "fun_fact",
              title: "Did you know?",
              markdown: "Your phone keyboard's next-word suggestions come from a small AI model that learned from lots of text.",
            },
            quickQuiz("check", [
              {
                kind: "mcq",
                id: "q1",
                prompt: "What makes an AI system different from a normal program?",
                options: [
                  { id: "a", text: "It is always faster" },
                  { id: "b", text: "It learns patterns from examples" },
                  { id: "c", text: "It never makes mistakes" },
                ],
                correct_option_id: "b",
                explanation: "AI learns patterns from examples instead of only following hand-written rules — and it can still make mistakes!",
              },
              {
                kind: "true_false",
                id: "q2",
                statement: "A calculator uses AI to add numbers.",
                answer: false,
                explanation: "A calculator follows exact rules. No learning needed.",
              },
            ]),
          ],
        },
        {
          id: u(1002),
          version_id: u(5002),
          slug: "learning-from-examples",
          title: "Learning from examples",
          summary: "Put the steps of training an AI in order — then see how it really works.",
          estimated_minutes: 15,
          blocks: [
            {
              id: "order",
              type: "drag_sort",
              phase: "activity",
              prompt: "You want to teach a computer to recognise mangoes. Put these steps in order.",
              items: [
                { id: "collect", text: "Collect lots of fruit photos" },
                { id: "label", text: "Label each photo: mango or not mango" },
                { id: "train", text: "Let the computer look for patterns" },
                { id: "test", text: "Test it on photos it has never seen" },
              ],
              feedback_correct: "Exactly how real AI training works!",
              feedback_incorrect: "Close! Think: what do you need before the computer can look for patterns?",
            },
            reflect("notice"),
            {
              id: "video",
              type: "video",
              phase: "module",
              title: "How a neural network learns (sample video — replace with your own)",
              provider: "youtube",
              url: "https://www.youtube-nocookie.com/embed/aircAruvnKk",
              transcript: "Sample video. Replace with a Class 7–8 friendly explainer and add a captions file.",
            },
            {
              id: "concept",
              type: "rich_text",
              phase: "module",
              markdown:
                "## Training data\n\nThe examples an AI learns from are called **training data**. Good training data is:\n\n- **Big** — many examples\n- **Varied** — ripe, raw, cut, in a basket…\n- **Correctly labelled** — wrong labels teach wrong patterns",
            },
            {
              id: "points",
              type: "key_points",
              phase: "module",
              title: "Remember",
              points: ["AI learns from examples called training data", "Testing uses examples it has never seen", "Bad data → bad AI"],
            },
            quickQuiz("check", [
              {
                kind: "short_answer",
                id: "q1",
                prompt: "What do we call the examples an AI learns from? (two words)",
                accepted_answers: ["training data", "training-data"],
                explanation: "They're called training data.",
              },
              {
                kind: "mcq",
                id: "q2",
                prompt: "Why do we test with new photos?",
                options: [
                  { id: "a", text: "To check it learned the pattern, not just memorised" },
                  { id: "b", text: "Because old photos are blurry" },
                ],
                correct_option_id: "a",
                explanation: "New photos show whether the AI really learned what a mango looks like.",
              },
            ]),
          ],
        },
      ],
    },
  ],
};

// ---------------------------------------------------------------------------
// Course 2 — big, paid
// ---------------------------------------------------------------------------
const aiExplorers: SeedCourse = {
  id: u(2),
  slug: "ai-explorers",
  title: "AI Explorers",
  subtitle: "A 6-lesson journey from patterns to publishing your own AI-made web page.",
  description:
    "Two modules, six hands-on lessons. Sort, match, predict and simulate to understand how AI finds patterns — then build and publish something real.",
  outcomes: [
    "Describe how AI uses data to find patterns",
    "Predict and test what an AI model will do",
    "Use a simulation to see a neural network learn",
    "Publish a web page and explain how AI helped make it",
  ],
  course_type: "big",
  class_levels: [7, 8],
  subject: "ai",
  is_free: false,
  price_paise: 49900,
  cover_image_path: "/seed/ai-explorers.svg",
  modules: [
    {
      id: u(201),
      title: "Module 1 · Data and patterns",
      description: "How AI turns examples into patterns.",
      lessons: [
        {
          id: u(2001),
          version_id: u(6001),
          slug: "sorting-the-world",
          title: "Sorting the world",
          summary: "Match things to the way AI would group them.",
          estimated_minutes: 15,
          is_preview: true,
          blocks: [
            {
              id: "match",
              type: "match_pairs",
              phase: "activity",
              prompt: "Match each input with what an AI might learn to predict from it.",
              pairs: [
                { id: "p1", left: "A photo of a leaf", right: "Plant disease" },
                { id: "p2", left: "A voice recording", right: "The words spoken" },
                { id: "p3", left: "Past weather readings", right: "Tomorrow's rain" },
                { id: "p4", left: "An email", right: "Spam or not spam" },
              ],
            },
            reflect("notice"),
            {
              id: "concept",
              type: "rich_text",
              phase: "module",
              markdown: "## Inputs and outputs\n\nEvery AI model takes an **input** (a photo, a sound, numbers) and gives an **output** (a label, a word, a number). It learns the link between them from examples.",
            },
            { id: "points", type: "key_points", phase: "module", title: "Key points", points: ["Input → model → output", "The model learns the link from examples"] },
            quickQuiz("check", [
              { kind: "true_false", id: "q1", statement: "A spam filter's input is an email.", answer: true, explanation: "It reads the email and outputs spam / not spam." },
            ]),
          ],
        },
        {
          id: u(2002),
          version_id: u(6002),
          slug: "fill-the-gaps",
          title: "Fill the gaps",
          summary: "Complete the sentences about how AI learns.",
          estimated_minutes: 12,
          blocks: [
            {
              id: "gaps",
              type: "fill_blank",
              phase: "activity",
              prompt: "Use the word bank to complete the sentence.",
              text: "An AI {{0}} learns patterns from {{1}} and is then {{2}} on examples it has never seen.",
              blanks: [{ answers: ["model"] }, { answers: ["data", "examples"] }, { answers: ["tested"] }],
              word_bank: ["model", "data", "tested", "painted"],
              case_sensitive: false,
            },
            reflect("notice", "Which word was hardest to place? Why?"),
            {
              id: "tip",
              type: "callout",
              phase: "module",
              variant: "tip",
              title: "Word watch",
              markdown: "**Model** = the thing that has learned. **Data** = what it learned from.",
            },
            { id: "concept", type: "rich_text", phase: "module", markdown: "Training is like practice; testing is like the exam with new questions." },
            quickQuiz("check", [
              {
                kind: "mcq",
                id: "q1",
                prompt: "Training an AI is most like…",
                options: [
                  { id: "a", text: "Practising with examples" },
                  { id: "b", text: "Copying the answer key" },
                ],
                correct_option_id: "a",
                explanation: "It practises on examples so it can handle new ones.",
              },
            ]),
          ],
        },
        {
          id: u(2003),
          version_id: u(6003),
          slug: "predict-the-robot",
          title: "Predict the robot",
          summary: "Guess what a trained model will say — then see why.",
          estimated_minutes: 12,
          blocks: [
            {
              id: "predict",
              type: "predict_then_reveal",
              phase: "activity",
              prompt: "A model trained only on photos of red apples sees a green apple. What will it say?",
              options: [
                { id: "apple", text: "Apple" },
                { id: "not", text: "Not an apple" },
                { id: "unsure", text: "It can't decide" },
              ],
              reveal: "It will probably say **not an apple** — it never saw a green one, so it learned \"apples are red\". This is called **bias in the data**.",
            },
            reflect("notice"),
            { id: "concept", type: "rich_text", phase: "module", markdown: "## Bias\n\nIf training data is missing kinds of examples, the model's answers will be unfair or wrong for those cases." },
            quickQuiz("check", [
              { kind: "true_false", id: "q1", statement: "More varied data helps reduce bias.", answer: true, explanation: "Variety teaches the model about more cases." },
            ]),
          ],
        },
      ],
    },
    {
      id: u(202),
      title: "Module 2 · Make it real",
      description: "Simulate, build and publish.",
      lessons: [
        {
          id: u(2004),
          version_id: u(6004),
          slug: "neural-network-playground",
          title: "Neural network playground",
          summary: "Press play and watch a tiny neural network learn.",
          estimated_minutes: 20,
          blocks: [
            {
              id: "sim",
              type: "embed_sim",
              phase: "activity",
              title: "TensorFlow Playground",
              url: "https://playground.tensorflow.org",
              instructions: "Press ▶ and watch the colours. Try adding a neuron with **+** and press play again.",
              height: 560,
            },
            reflect("notice", "What changed when you added more neurons?"),
            { id: "concept", type: "rich_text", phase: "module", markdown: "A **neural network** is made of simple units (neurons) that adjust their connections a tiny bit after every example." },
            quickQuiz("check", [
              {
                kind: "short_answer",
                id: "q1",
                prompt: "What are the small units in a neural network called?",
                accepted_answers: ["neurons", "neuron", "nodes"],
                explanation: "They're called neurons (or nodes).",
              },
            ]),
          ],
        },
        {
          id: u(2005),
          version_id: u(6005),
          slug: "train-it-offline",
          title: "Train it offline",
          summary: "Be the AI: sort cards by hand, then share a photo of your result.",
          estimated_minutes: 25,
          blocks: [
            {
              id: "cards",
              type: "checklist_task",
              phase: "activity",
              prompt: "Grab 10 small pieces of paper. Do these steps and tick each one off.",
              steps: [
                { id: "s1", text: "Draw 5 happy faces and 5 sad faces, one per paper" },
                { id: "s2", text: "Mix them up" },
                { id: "s3", text: "Ask someone to sort them without telling them the rule" },
                { id: "s4", text: "Write down what clues they used" },
              ],
            },
            {
              id: "photo",
              type: "upload_work",
              phase: "activity",
              prompt: "Upload a photo of your sorted piles (no faces of people, please!).",
              accept: ["image"],
              max_files: 2,
            },
            reflect("notice", "What clues did your helper use to sort?"),
            { id: "concept", type: "rich_text", phase: "module", markdown: "Your helper found **features** — like the curve of the mouth. AI models find features too, automatically." },
            quickQuiz("check", [
              { kind: "true_false", id: "q1", statement: "Features are clues a model uses to decide.", answer: true, explanation: "Yes — like mouth shape for happy/sad." },
            ]),
          ],
        },
        {
          id: u(2006),
          version_id: u(6006),
          slug: "publish-your-page",
          title: "Publish your AI-made web page",
          summary: "Use an AI helper to make a one-page website and put it online with Netlify Drop.",
          estimated_minutes: 30,
          blocks: [
            {
              id: "task",
              type: "external_task",
              phase: "activity",
              tool_id: TOOL_IDS.netlify,
              goal: "Publish a one-page website about your favourite animal and share its link.",
              steps: [
                { id: "s1", text: "Copy the starter prompt and ask your approved AI helper to write an index.html file." },
                { id: "s2", text: "Save the code as index.html inside a new folder on your computer." },
                { id: "s3", text: "Click Launch tool. Drag the whole folder onto the Netlify Drop page." },
                { id: "s4", text: "Copy the link that ends in .netlify.app and paste it below." },
              ],
              starter_prompts: [
                {
                  id: "p1",
                  label: "Starter prompt",
                  text: "Write a single index.html file (HTML + CSS, no JavaScript) for a colourful one-page website about the [animal]. Include a title, 3 fun facts and a short quiz question at the bottom. Keep it suitable for a 13-year-old.",
                },
              ],
              estimated_minutes: 20,
              submission_types: ["url", "screenshot"],
              fallback: {
                kind: "with_parent",
                instructions: "Netlify needs you to be 13 or older. Ask a parent or guardian to do the **Launch tool** step with you on their device, then paste the link here together.",
              },
            },
            reflect("notice", "Which part did the AI do well, and what did you have to fix yourself?"),
            { id: "concept", type: "rich_text", phase: "module", markdown: "## AI as a helper\n\nAI tools can draft code fast, but **you** are the editor: check facts, fix mistakes and decide what's good." },
            { id: "points", type: "key_points", phase: "module", title: "Remember", points: ["Check what AI writes", "Never share personal details on a public page", "You're the editor"] },
            quickQuiz("check", [
              {
                kind: "mcq",
                id: "q1",
                prompt: "What should you NEVER put on your public page?",
                options: [
                  { id: "a", text: "Fun facts about animals" },
                  { id: "b", text: "Your home address or phone number" },
                ],
                correct_option_id: "b",
                explanation: "Public pages can be seen by anyone. Keep personal details private.",
              },
            ]),
          ],
        },
      ],
    },
  ],
};

// ---------------------------------------------------------------------------
// Course 3 — Physical AI Lab: a ladder of rover projects, easy → hard.
// Each project = a robot_sim block (the student supervises a model in a 3D
// simulator) + the idea behind it + a quick check.
// ---------------------------------------------------------------------------
const sim = (
  id: string,
  props: Omit<Extract<Block, { type: "robot_sim" }>, "id" | "type" | "phase">,
): Extract<Block, { type: "robot_sim" }> => ({ id, type: "robot_sim", phase: "activity", ...props });

const physicalAi: SeedCourse = {
  id: u(3),
  slug: "physical-ai",
  title: "Physical AI Lab",
  subtitle: "Six rover projects, easy to hard: teach a robot by example, train a model, watch it drive itself.",
  description:
    "Physical AI is AI that moves in the real world — robots, rovers, drones. In this lab you are the supervisor: you show a rover what to do, a model learns from your examples, and then it has to drive on its own in a 3D simulator. Projects get harder step by step.",
  outcomes: [
    "Explain supervised learning: examples in, a model out",
    "Collect good training data by driving and by labelling",
    "Read a robot's sensors and predict what it will do",
    "Train a nearest-example model and a small neural network",
    "Diagnose a robot that fails: not enough data, contradictions, noise",
  ],
  course_type: "big",
  class_levels: [7, 8],
  subject: "ai",
  is_free: false,
  price_paise: 79900,
  cover_image_path: "/seed/physical-ai.svg",
  modules: [
    {
      id: u(301),
      title: "Level 1 · Teach by driving",
      description: "Your driving becomes the robot's training data.",
      lessons: [
        {
          id: u(3001),
          version_id: u(7001),
          slug: "drive-to-the-flag",
          title: "Project 1 · Drive to the flag",
          summary: "Easy. Open field, no walls. Show the rover the way, then let it go alone.",
          estimated_minutes: 15,
          is_preview: true,
          blocks: [
            sim("rover", {
              title: "Drive to the flag",
              goal: "Drive the rover to the green flag **a few times**. Then train the model and press *Let it drive*. If it reaches the flag on its own within 30 seconds, you pass.",
              arena: "open-field",
              difficulty: 1,
              mode: "demonstrate",
              learner: "knn",
              min_examples: 20,
              sensor_noise: 0,
              pass: { max_seconds: 30, max_bumps: 0 },
              hints: ["Drive smoothly — jerky driving gives the model mixed messages.", "Reset and drive to the flag two or three times from the start."],
            }),
            reflect("notice", "When the rover drove alone, did it do anything you didn't teach it? Why do you think that happened?"),
            {
              id: "idea",
              type: "rich_text",
              phase: "module",
              markdown:
                "## You were the supervisor\n\nEvery tenth of a second you drove, the simulator wrote down one **example**: what the sensors saw (*input*) and what you did (*output*).\n\nTraining a **supervised model** means giving it lots of these input→output pairs. It never saw the flag — only numbers like *how far is the flag to the left* — and it learned to copy your choices.\n\nThis is how real self-driving systems started: humans drove, cameras and sensors recorded, and a model learned to imitate. It's called **learning from demonstration**.",
            },
            { id: "points", type: "key_points", phase: "module", title: "Key points", points: ["Input = sensor readings, output = your action", "A model copies the pattern in your examples", "More good examples → a better rover"] },
            quickQuiz("check", [
              {
                kind: "mcq",
                id: "q1",
                prompt: "What did the model learn from?",
                options: [
                  { id: "a", text: "A map of the arena" },
                  { id: "b", text: "Your examples: sensors in, action out" },
                  { id: "c", text: "Rules someone typed in" },
                ],
                correct_option_id: "b",
                explanation: "The model only ever saw your examples — sensor numbers paired with the action you chose.",
              },
              { kind: "true_false", id: "q2", statement: "The rover can only do things that appeared in your examples.", answer: true, explanation: "It copies patterns from the examples. New situations that look like nothing it has seen confuse it." },
            ]),
          ],
        },
        {
          id: u(3002),
          version_id: u(7002),
          slug: "around-the-wall",
          title: "Project 2 · Around the wall",
          summary: "Easy. A wall blocks the straight path. Teach the turn, not just the straight bit.",
          estimated_minutes: 20,
          blocks: [
            sim("rover", {
              title: "Around the wall",
              goal: "There's a wall between the rover and the flag. Drive around it **several times, both ways**. Watch the front ray turn red as you get close — that's what the model will use to decide when to turn.",
              arena: "wall-ahead",
              difficulty: 2,
              mode: "demonstrate",
              learner: "knn",
              min_examples: 40,
              sensor_noise: 0,
              pass: { max_seconds: 40, max_bumps: 3 },
              hints: ["Start turning when the front ray goes orange, not when it's red.", "Go around on the left some runs and on the right in others, so the model learns both.", "After a failed test, teach it in exactly the spot where it got stuck."],
            }),
            reflect("notice", "Which sensor changes most just before you turn? How could the rover use it?"),
            {
              id: "idea",
              type: "rich_text",
              phase: "module",
              markdown:
                "## Sensors are all the robot has\n\nThe rover has three **distance rays** (left, front, right) and knows which way the flag is. It cannot see the wall — it only sees *front ray = 0.3*. If your examples always turned at the last moment, the model learned \"turn only when the front ray is tiny\" and slams into the wall first.\n\n**Good training data covers the tricky moments**, not just the easy straight parts. Engineers call this *coverage*.",
            },
            quickQuiz("check", [
              {
                kind: "mcq",
                id: "q1",
                prompt: "The rover keeps bumping the wall. The most likely fix is:",
                options: [
                  { id: "a", text: "Drive faster" },
                  { id: "b", text: "Give more examples of turning early near the wall" },
                  { id: "c", text: "Delete all the examples where you turned" },
                ],
                correct_option_id: "b",
                explanation: "The model needs examples of the moment to turn. Missing situations can't be learned.",
              },
            ]),
          ],
        },
        {
          id: u(3003),
          version_id: u(7003),
          slug: "follow-the-line",
          title: "Project 3 · Follow the line",
          summary: "Medium. A painted line with two bends, and your first neural network.",
          estimated_minutes: 25,
          blocks: [
            sim("rover", {
              title: "Follow the line",
              goal: "Keep the rover on the line all the way to the flag. The **line sensor** tells it whether the line is to the left or right. This project trains a small **neural network** — watch its error fall as it learns.",
              arena: "line-track",
              difficulty: 3,
              mode: "demonstrate",
              learner: "mlp",
              min_examples: 60,
              sensor_noise: 0,
              pass: { max_seconds: 60, max_bumps: 2 },
              hints: ["Small corrections: tap left/right briefly to stay centred.", "Train, test, then teach more on the bend where it drifted."],
            }),
            reflect("notice", "What did the training error (loss) curve look like? What do you think it means when it stops falling?"),
            {
              id: "idea",
              type: "rich_text",
              phase: "module",
              markdown:
                "## A neural network finds the rule\n\nThe first two projects used a **nearest-example** model: it searched your examples for the most similar one and copied it.\n\nA **neural network** is different. It starts with random numbers (weights) and in each training round nudges them so its answers match your examples a little better. The **loss** is its average error — when it stops falling, the network has found the best rule it can from your data.\n\nThe network never stores your examples. It stores a *rule*, which is why it can be tiny and still fast enough for a real robot.",
            },
            quickQuiz("check", [
              {
                kind: "mcq",
                id: "q1",
                prompt: "During training, the loss going down means…",
                options: [
                  { id: "a", text: "The rover is driving faster" },
                  { id: "b", text: "The network's answers match the examples better" },
                  { id: "c", text: "There are fewer examples" },
                ],
                correct_option_id: "b",
                explanation: "Loss is the average error between the network's answer and your choice.",
              },
              { kind: "true_false", id: "q2", statement: "A trained neural network keeps a copy of every example.", answer: false, explanation: "It keeps weights (numbers) that encode a rule, not the examples." },
            ]),
          ],
        },
      ],
    },
    {
      id: u(302),
      title: "Level 2 · Label, generalise, cope with noise",
      description: "Harder arenas, less perfect data.",
      lessons: [
        {
          id: u(3004),
          version_id: u(7004),
          slug: "teach-by-labelling",
          title: "Project 4 · Teach by labelling",
          summary: "Medium. No driving: the rover shows you a situation and you label the right move.",
          estimated_minutes: 20,
          blocks: [
            sim("rover", {
              title: "Teach by labelling",
              goal: "This time you don't drive. The rover is dropped into a random spot in the slalom; read its sensors on the map and **label** what it should do. Label at least 30 situations, train, and let it run.",
              arena: "slalom",
              difficulty: 3,
              mode: "label",
              learner: "knn",
              min_examples: 30,
              sensor_noise: 0,
              pass: { max_seconds: 40, max_bumps: 2 },
              hints: ["Facing a post → turn toward the side with the longer ray.", "Nothing close → turn toward the flag (the flag bar shows which side it's on).", "Skip situations you're not sure about — a wrong label is worse than none."],
            }),
            reflect("notice", "Labelling vs. driving: which gave the rover better examples, and why?"),
            {
              id: "idea",
              type: "rich_text",
              phase: "module",
              markdown:
                "## Labelled data\n\nMost real AI is trained on **labelled data**: photos someone tagged \"stop sign\", recordings someone typed out, sensor snapshots someone marked *turn left*. Labelling is slower than driving but gives **cleaner, more varied** examples — you can show the model rare situations on purpose.\n\nA wrong label teaches the model a wrong rule. That's why big AI projects check their labels carefully.",
            },
            quickQuiz("check", [
              {
                kind: "mcq",
                id: "q1",
                prompt: "Why might labelling give better training data than driving?",
                options: [
                  { id: "a", text: "You can cover rare situations on purpose" },
                  { id: "b", text: "It records more examples per second" },
                  { id: "c", text: "The model prefers short examples" },
                ],
                correct_option_id: "a",
                explanation: "Random drops let you label situations driving rarely reaches.",
              },
            ]),
          ],
        },
        {
          id: u(3005),
          version_id: u(7005),
          slug: "escape-the-maze",
          title: "Project 5 · Escape the maze",
          summary: "Hard. Corridors and corners. Drive and label; the model must handle places you never visited.",
          estimated_minutes: 30,
          blocks: [
            sim("rover", {
              title: "Escape the maze",
              goal: "Combine both ways of teaching: **drive** through the maze several times, then **label** random situations to fill the gaps. The network has to cope with corners it hasn't seen in exactly that way — that's called generalising.",
              arena: "maze",
              difficulty: 4,
              mode: "both",
              learner: "mlp",
              min_examples: 120,
              sensor_noise: 0,
              pass: { max_seconds: 60, max_bumps: 6 },
              hints: ["Keep a steady distance from walls while driving — the model learns your habits.", "If it turns the wrong way at a corner, label 10 situations near that corner.", "Accuracy below 75%? Your examples contradict each other — clear and drive more consistently."],
            }),
            reflect("notice", "Describe one situation where the rover did the right thing even though you never drove exactly there."),
            {
              id: "idea",
              type: "rich_text",
              phase: "module",
              markdown:
                "## Generalising\n\nA model is only useful if it works in situations that are *similar but not identical* to its examples. That is **generalisation**, and it's the whole point of learning instead of memorising.\n\nTwo things help: **variety** (many different situations) and **consistency** (the same situation always gets the same action). Contradicting examples pull the network in two directions and its accuracy drops.",
            },
            quickQuiz("check", [
              {
                kind: "mcq",
                id: "q1",
                prompt: "The held-out accuracy is 60%. What does that tell you?",
                options: [
                  { id: "a", text: "The arena is too big" },
                  { id: "b", text: "On unseen examples the model often disagrees with you — the data is thin or contradictory" },
                  { id: "c", text: "Training ran too long" },
                ],
                correct_option_id: "b",
                explanation: "Held-out accuracy checks the model on examples it didn't train on — an honest score.",
              },
            ]),
          ],
        },
        {
          id: u(3006),
          version_id: u(7006),
          slug: "noisy-delivery",
          title: "Project 6 · Noisy delivery",
          summary: "Hardest. Real sensors are fuzzy. Deliver through a cluttered yard with noisy readings.",
          estimated_minutes: 30,
          blocks: [
            sim("rover", {
              title: "Noisy delivery",
              goal: "The sensors now have **noise** — every reading is a little wrong, like a real robot at night. Teach by driving and labelling, train the network, and deliver the parcel with at most 3 bumps.",
              arena: "delivery",
              difficulty: 5,
              mode: "both",
              learner: "mlp",
              min_examples: 150,
              sensor_noise: 0.1,
              pass: { max_seconds: 60, max_bumps: 3 },
              hints: ["Leave more room near posts — with noise, 'close' might be closer than it looks.", "Lots of examples average the noise out. Aim for 200+.", "Train again after adding examples; the network doesn't update on its own."],
            }),
            reflect("notice", "How did noise change the way you drove? What would you add to a real rover to make it more reliable?"),
            {
              id: "idea",
              type: "rich_text",
              phase: "module",
              markdown:
                "## Physical AI meets the real world\n\nReal sensors are never perfect: dust, sunlight, bumps and cheap parts all add **noise**. A model trained only on clean data breaks the moment reality is messy.\n\nRoboticists fight noise with **more data**, **smoother behaviour** (don't react to a single reading) and **better sensors**. The same ideas apply to any AI that acts in the world — from warehouse robots to self-driving cars.",
            },
            quickQuiz("check", [
              {
                kind: "true_false",
                id: "q1",
                statement: "With noisy sensors, more training examples usually help because the noise averages out.",
                answer: true,
                explanation: "Each example is a bit wrong in a random direction; many examples reveal the true pattern.",
              },
              {
                kind: "mcq",
                id: "q2",
                prompt: "Which is NOT a way to make a real rover more reliable?",
                options: [
                  { id: "a", text: "Collect more varied examples" },
                  { id: "b", text: "Only test it in the simulator" },
                  { id: "c", text: "Use better sensors" },
                ],
                correct_option_id: "b",
                explanation: "Simulators help, but the real world always adds surprises — test there too.",
              },
            ]),
          ],
        },
      ],
    },
  ],
};

export const courses: SeedCourse[] = [whatIsAi, aiExplorers, physicalAi];
