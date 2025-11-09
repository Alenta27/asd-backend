require('dotenv').config();
const mongoose = require('mongoose');
const EducationalContent = require('./models/educationalContent');

const educationalData = [
  // Learn the Signs
  {
    category: 'learn-signs',
    topic: 'what-is-autism',
    title: 'What is Autism?',
    order: 1,
    content: `Autism Spectrum Disorder (ASD) is a neurodevelopmental condition that affects how people communicate, interact with others, and perceive the world around them.

Key Characteristics:
• Differences in social communication and interaction
• Repetitive behaviors and restricted interests
• Sensory sensitivities (heightened or reduced sensitivity to sounds, lights, textures)
• Unique ways of learning and processing information

Important Facts:
✓ Autism is NOT a disease or mental illness
✓ Autism is a lifelong condition, not something that can be "cured"
✓ Autistic individuals have unique strengths and abilities
✓ Every autistic person is different - autism presents differently in each individual
✓ With proper support, autistic individuals can thrive in school, work, and relationships

Autism affects about 1 in 36 children worldwide, making it more common than many people realize. Early identification and support can lead to better outcomes.`
  },
  {
    category: 'learn-signs',
    topic: 'symptoms-of-autism',
    title: 'Signs and Symptoms of Autism',
    order: 2,
    content: `Autism can present in many different ways. Common signs include:

Social and Communication Challenges:
• Difficulty making eye contact or using facial expressions
• Trouble understanding jokes, sarcasm, or figurative language
• Challenges with back-and-forth conversations
• Difficulty understanding other people's emotions or intentions
• Preference for solitary activities over social interaction
• Difficulty with social rules and unwritten social expectations

Behavioral and Repetitive Patterns:
• Repetitive movements (stimming) like hand flapping, spinning, or rocking
• Lining up toys instead of playing with them
• Intense, focused interests that dominate their time
• Preference for routines and predictability
• Distress when routines change
• Unusual play patterns

Sensory Differences:
• Covering ears in response to sounds others find normal
• Seeking out or avoiding certain textures, tastes, or smells
• Difficulty with certain clothing (tags, tight fitting)
• Sensitivity to bright lights or flickering screens
• Unusual reactions to pain or temperature

Important: Signs vary greatly between individuals. A child may show some of these signs but not others. Girls and older children may mask or hide autistic traits, making autism harder to spot.`
  },
  {
    category: 'learn-signs',
    topic: 'causes-of-autism',
    title: 'What Causes Autism?',
    order: 3,
    content: `The exact cause of autism is not fully understood, but research shows it involves both genetic and environmental factors:

Genetic Factors:
• Autism runs in families - if one family member has autism, others may too
• Multiple genes are involved, not just one
• Some genetic conditions increase autism risk
• Inherited genetic predispositions contribute to autism development

Brain Development:
• Differences in how the brain develops and organizes
• Variations in brain structure and neural connections
• Different patterns of brain activity
• Unique neurological wiring present from birth

Environmental Factors Being Studied:
• Advanced parental age
• Certain prenatal medications
• Premature birth or low birth weight
• Some infections during pregnancy

IMPORTANT - MYTHS DEBUNKED:
❌ MYTH: Vaccines cause autism
✅ FACT: Extensive scientific research has proven there is NO link between vaccines and autism. The original study claiming this was fraudulent.

❌ MYTH: Autism is caused by poor parenting
✅ FACT: Parenting style does NOT cause autism. Autism is a neurodevelopmental difference present from birth.

❌ MYTH: Too much screen time causes autism
✅ FACT: Screen time does not cause autism, though it may mask or hide signs.

Autism is not caused by anything parents did or didn't do. It's a naturally occurring neurological variation.`
  },
  {
    category: 'learn-signs',
    topic: 'autism-in-girls',
    title: 'Autism in Girls and Women',
    order: 4,
    content: `Girls and women with autism are often missed or diagnosed later because they present differently than boys:

Why Girls Are Often Missed:
• Girls tend to "mask" or "camouflage" their autistic traits better
• They may hide stimming behaviors in social situations
• Girls might have different types of special interests (animals, books) vs boys (trains, numbers)
• Girls may have better social imitation skills
• Teachers and parents may not recognize autism in girls

Common Traits in Autistic Girls:
• Intense, all-consuming interests that others don't notice as "unusual"
• Better at reading social situations but still find them exhausting
• Social friendships may be one-on-one rather than groups
• Perfectionism and anxiety related to performance
• "Shy" or quiet demeanor
• Creative or imaginative play that appears typical
• Extreme sensitivity to criticism
• Meltdowns at home after masking at school

Challenges:
• Late diagnosis (often not diagnosed until teenage years or adulthood)
• Higher rates of depression, anxiety, and eating disorders
• Social exhaustion from masking
• Self-esteem issues from not fitting in
• Risk of burnout from emotional regulation

Important: If you notice any signs of autism in girls/women in your life, encourage evaluation. Early support can make a huge difference.`
  },
  {
    category: 'learn-signs',
    topic: 'autism-adults',
    title: 'Autism in Adults',
    order: 5,
    content: `Many adults are diagnosed with autism for the first time in their 20s, 30s, 40s, or even later:

Why Adult Diagnosis Happens:
• Better awareness and understanding of autism today
• Recognition that autism presents differently in girls/women
• Personal recognition of their own traits
• Child's autism diagnosis prompting parent evaluation
• Crisis or life change bringing attention to underlying struggles

Common Experiences in Undiagnosed Autistic Adults:
• Feeling like they've never quite "fit in"
• Struggling with employment despite being intelligent
• Anxiety or depression that doesn't fully respond to standard treatment
• Difficulty maintaining relationships
• Burnout from constantly adapting to social expectations
• Sensory overwhelm in certain environments
• Achievement despite significant internal struggle

Benefits of Adult Diagnosis:
✓ Self-understanding and validation
✓ Access to accommodations at work
✓ Relief from years of confusion and self-blame
✓ Connection with autistic community
✓ Ability to make life choices aligned with autistic needs
✓ Strategies tailored to autistic strengths and challenges

Adult Autistic Strengths:
• Attention to detail and accuracy
• Ability to hyperfocus on areas of interest
• Creative and innovative thinking
• Honesty and direct communication
• Pattern recognition and problem-solving
• Loyalty and commitment

If you suspect you may be autistic, seeking evaluation can provide clarity and open doors to support and self-acceptance.`
  },

  // Screening
  {
    category: 'screening',
    topic: 'autism-screening',
    title: 'What is Autism Screening?',
    order: 1,
    content: `Screening is the first step in identifying autism. It's different from diagnosis:

What is Screening?
• A quick assessment to identify if a child may have autism
• Uses questionnaires or observations
• Done by pediatricians, teachers, or other professionals
• Takes 15-30 minutes usually
• Results in "positive" or "negative" screening

Screening is NOT Diagnosis:
• Screening is a preliminary check, not a final diagnosis
• A positive screening means further evaluation is needed
• A negative screening doesn't rule out autism
• Diagnosis requires comprehensive evaluation by specialists

Why Screen for Autism?
• Early detection leads to early intervention
• Early intervention improves outcomes significantly
• Helps identify children who need support services
• Provides parents with information about their child's development
• Can reduce anxiety by giving clear answers about concerns

Common Screening Tools:
• M-CHAT (Modified Checklist for Autism in Toddlers) - Ages 16-30 months
• CARS (Childhood Autism Rating Scale)
• SCQ (Social Communication Questionnaire)
• ADOS (Autism Diagnostic Observation Schedule)

When Screening Happens:
• Routine check-ups at pediatrician (18-24 months)
• When parents express concerns
• When teachers notice developmental differences
• When another child in the family is diagnosed

Screening is a simple, non-invasive way to identify children who may benefit from professional evaluation and support services.`
  },
  {
    category: 'screening',
    topic: 'screening-questionnaire',
    title: 'Screening Questionnaires',
    order: 2,
    content: `Different screening tools are used depending on the child's age:

M-CHAT (Modified Checklist for Autism in Toddlers):
Age: 16-30 months
• 20 yes/no questions
• Focuses on social communication and behaviors
• Takes about 5-10 minutes
• Done by parents or professionals
• Most commonly used screening tool in the US

What M-CHAT Asks About:
• Does the child look where you point?
• Does the child point to show you something?
• Does the child understand simple instructions?
• Does the child use words or sounds?
• Does the child copy actions?
• Does the child understand the emotions of others?
• Does the child engage in pretend play?

CARS (Childhood Autism Rating Scale):
• For children 2 years and older
• Observational assessment (15 areas rated)
• Takes 5-30 minutes depending on format
• Requires professional training
• Rates severity from mild to severe

SCQ (Social Communication Questionnaire):
• For children 4+ years and adults
• 40-item questionnaire
• Quick administration (5-10 minutes)
• Can be done by parents or professionals
• Good for identifying need for further testing

ADOS (Autism Diagnostic Observation Schedule):
• Gold standard diagnostic tool
• Observational assessment with structured activities
• Different modules for different ages/abilities
• Requires trained clinician
• Takes 30-60 minutes
• Often used for formal diagnosis

What Screening Results Mean:
✓ POSITIVE SCREEN: Child scored above threshold, needs comprehensive evaluation
✓ NEGATIVE SCREEN: Child scored below threshold, but concerns should still be discussed
✓ INCONCLUSIVE: May need re-screening or further assessment

Important: No screening tool is 100% accurate. Results should always be discussed with healthcare providers.`
  },
  {
    category: 'screening',
    topic: 'early-signs',
    title: 'Early Signs in Infants and Toddlers',
    order: 3,
    content: `Early signs of autism can appear in infancy and toddlerhood:

Before 12 Months:
• Limited eye contact or doesn't look at faces
• Doesn't respond to their name
• Doesn't reach for objects or people
• Limited babbling or unusual sounds
• Doesn't engage in back-and-forth interaction
• Stiff posture or unusual movements
• Doesn't smile socially

12-24 Months:
• Delayed speech or language development
• Doesn't point to share things
• Doesn't follow simple gestures
• Isn't interested in other children
• Repeats words or phrases (echolalia)
• Lines up toys instead of playing with them
• Becomes distressed by small changes in routine
• Excessive spinning or hand flapping
• Unusual attachment to objects

24-36 Months:
• Limited conversation skills
• Difficulty with transitions
• Intense, narrow interests
• Plays alone rather than with peers
• Unusual sensory behaviors (covering ears, seeking textures)
• Difficulty following multi-step instructions
• Difficulty expressing needs or emotions verbally

Red Flags That Warrant Evaluation:
🚩 No babbling or speech by 12 months
🚩 Loss of language or skills (regression)
🚩 No pointing or showing by 12 months
🚩 Not responding to name by 12 months
🚩 Extreme resistance to changes
🚩 Severe tantrums or rigid behavior
🚩 Unusual sensory responses
🚩 Lack of interest in other children

What You Should Do:
1. Trust your instincts - you know your child best
2. Discuss concerns with pediatrician
3. Request evaluation if concerned
4. Early intervention services are free in most places
5. Don't wait - early action makes a difference

Remember: Not all children develop at the same pace. However, if you have concerns, it's always better to get them checked out.`
  },
  {
    category: 'screening',
    topic: 'diagnostic-process',
    title: 'The Diagnostic Process',
    order: 4,
    content: `A comprehensive diagnosis involves several steps:

Step 1: Initial Consultation
• History of developmental milestones
• Family history of autism or developmental delays
• Current concerns and behaviors
• Medical history
• Review of early videos/photos

Step 2: Standardized Testing
• Autism Diagnostic Observation Schedule (ADOS)
• Autism Diagnostic Interview (ADI-R)
• Cognitive testing
• Language assessment
• Other specialized tests based on presentation

Step 3: Behavioral Observation
• Structured activities and play
• Response to social interaction
• Communication patterns
• Behavioral responses
• Sensory responses

Step 4: Developmental Assessment
• Fine motor skills
• Gross motor skills
• Language development
• Cognitive abilities
• Social-emotional development

Step 5: Review and Diagnosis
• All information compiled
• Professional clinical judgment applied
• Diagnosis made based on DSM-5 criteria
• Support level determined (Level 1, 2, or 3)
• Recommendations provided

Who Can Diagnose?
• Developmental Pediatrician
• Child Psychologist
• Child Psychiatrist
• Neurologist with autism expertise
• Speech-Language Pathologist (can contribute but not diagnose alone)

Timeline:
• Initial appointment to diagnosis: Usually 2-4 weeks
• Can take longer in busy practices
• Multiple appointments typically needed

After Diagnosis:
• Written report provided
• Discussion of results
• Recommendations for support and services
• Referrals to specialists if needed
• Discussion of accommodations and interventions

Cost:
• Varies significantly by location and provider
• Insurance may cover part or all
• Some community health centers offer reduced-cost evaluations
• School-based evaluations may be free

Getting a diagnosis opens doors to support, accommodations, and services that can help your child thrive.`
  },
  {
    category: 'screening',
    topic: 'when-to-seek-help',
    title: 'When to Seek Professional Help',
    order: 5,
    content: `Parents should consider professional evaluation if they notice:

Communication Concerns:
• Speech is delayed or unusual
• Difficulty understanding language
• Doesn't respond to name
• Limited babbling or sounds
• Repeats words or phrases without meaning

Social Concerns:
• Difficulty with social interaction
• Doesn't make eye contact
• Doesn't engage in back-and-forth play
• Prefers to play alone
• Difficulty understanding others' emotions

Behavioral Concerns:
• Repetitive behaviors that are intense or distressing
• Extreme resistance to change
• Difficulty transitioning between activities
• Unusual movement patterns
• Self-injurious behaviors

Sensory Concerns:
• Extreme reactions to sounds, lights, or textures
• Covering ears frequently
• Unusual fascination with textures or movements
• Avoidance of certain foods
• Sensitivity to clothing

Learning Concerns:
• Struggles in school despite intelligence
• Difficulty following instructions
• Challenges with organization
• Extreme perfectionism
• Anxiety about academic performance

Emotional Concerns:
• Frequent meltdowns
• Anxiety or panic attacks
• Depression or withdrawn behavior
• Difficulty regulating emotions
• Seems distressed but can't explain why

Who to Contact First:
1. Your pediatrician - can provide referrals
2. School psychologist - can do school-based evaluation
3. Developmental pediatrician - specializes in developmental issues
4. Local autism center or diagnostic clinic
5. Regional early intervention program (if under 3)

Questions to Ask:
• What is your experience diagnosing autism?
• How long is your waiting list?
• Do you accept insurance?
• What is the cost?
• What does the evaluation process involve?
• When can we get started?

Trust Your Instincts:
• If you have concerns, seek evaluation
• Early identification leads to better outcomes
• Early intervention services are often free
• There's no harm in getting evaluated - it just provides information
• Don't wait - the earlier the better

Remember: You don't need a formal diagnosis to start getting support. Early intervention services are available to any child showing developmental delays.`
  },

  // Conditions
  {
    category: 'conditions',
    topic: 'sensory-issues',
    title: 'Sensory Sensitivities in Autism',
    order: 1,
    content: `Many autistic individuals experience heightened or reduced sensitivity to sensory input. This is a core feature of autism:

Auditory (Sound) Sensitivities:
• Extreme reactions to loud noises (alarms, vacuum, sirens)
• Difficulty filtering background noise
• Preference for quiet environments
• Covering ears in noisy places
• Distress in restaurants, stores, or crowded places
• Sensitivity to high-pitched sounds
• May need noise-canceling headphones

Visual (Sight) Sensitivities:
• Difficulty with bright lights or fluorescent lighting
• Sensitivity to flickering or blinking lights
• Distress from busy visual environments
• Difficulty with certain colors or patterns
• Preference for dimly lit environments
• May squint or look away frequently
• Sensitivity to computer or screen glare

Tactile (Touch) Sensitivities:
• Aversion to certain clothing textures or tags
• Difficulty with physical touch from others
• Pain sensitivity (may be high or low)
• Preference for certain fabrics
• Challenges with grooming or haircuts
• Difficulty with certain temperatures
• Avoidance of getting hands dirty or sticky

Taste and Smell Sensitivities:
• Limited diet - strong preferences and aversions
• Extreme reaction to certain smells
• May gag at unfamiliar foods
• Strong reaction to food textures
• Attraction to unusual smells
• Difficulty with personal hygiene products (toothpaste, shampoo)

Proprioceptive (Body Position) & Vestibular (Balance) Differences:
• May seek intense physical input (jumping, spinning, crashing into things)
• Difficulty judging personal space
• May be clumsy or have coordination challenges
• Avoidance of certain movements
• Seeking weighted pressure or tight spaces

Impact on Daily Life:
• School can be overwhelming (noise, crowds, sensory environments)
• Eating may be challenging due to food sensitivities
• Grooming and hygiene routines can be difficult
• Outings to stores or busy places are exhausting
• Sleep may be affected by sensory sensitivities
• Social situations become more stressful due to sensory overwhelm

Strategies That Help:
✓ Identify specific sensory triggers
✓ Modify the environment when possible
✓ Use sensory tools (headphones, weighted blankets, fidgets)
✓ Warn of upcoming sensory experiences
✓ Provide breaks in quiet spaces
✓ Allow preferred clothing and food choices
✓ Work with occupational therapist
✓ Practice gradual exposure to tolerable levels
✓ Validate the person's sensory experience

Many autistic individuals develop coping strategies and thrive with understanding and accommodations.`
  },
  {
    category: 'conditions',
    topic: 'co-occurring-conditions',
    title: 'Co-occurring Conditions with Autism',
    order: 2,
    content: `Autism frequently co-occurs with other conditions:

ADHD (Attention-Deficit/Hyperactivity Disorder):
• 50-80% of autistic people also have ADHD
• Difficulty focusing or organizing tasks
• Hyperfocus on preferred activities
• Impulsivity and restlessness
• Difficulty managing time
• Executive function challenges
• Symptoms may be masked by autism traits

Anxiety Disorders:
• Social anxiety - fear of social situations
• Generalized anxiety - worry about many things
• Performance anxiety - perfectionism and worry about mistakes
• Panic attacks or panic disorder
• Phobias and specific fears
• Obsessive-compulsive disorder (OCD)
• Anxiety often related to uncertainty and change

Depression:
• Feeling sad, hopeless, or empty
• Loss of interest in activities
• Social withdrawal
• Sleep and appetite changes
• Fatigue or low energy
• Difficulty concentrating
• Higher rates in undiagnosed or unsupported autistic individuals

Eating Disorders:
• Restrictive eating related to sensory issues
• Anxiety around unfamiliar foods
• Limited diet range
• Difficulty with texture, taste, or smell
• May develop restrictive eating patterns
• More common in autistic girls

Sleep Issues:
• Difficulty falling or staying asleep
• Anxiety at bedtime
• Irregular sleep schedules
• Sensitivity to light or sound in bedroom
• Stimming or racing thoughts at night
• Sleep problems may worsen anxiety and ADHD symptoms

OCD (Obsessive-Compulsive Disorder):
• Repetitive, intrusive thoughts (obsessions)
• Compulsive behaviors to reduce anxiety
• May overlap with autism stimming but causes distress
• Extreme perfectionism or need for symmetry
• Fear of contamination or harm
• Seeking reassurance repeatedly

Learning Disabilities:
• Dyslexia - difficulty with reading
• Dyscalculia - difficulty with math
• Dysgraphia - difficulty with writing
• Processing delays despite intelligence
• Specific skill deficits
• May not be detected if autism is obvious

Sensory Processing Disorder (SPD):
• Extreme sensory sensitivities
• Difficulty organizing sensory information
• Motor coordination difficulties
• Impacts function across settings
• May be diagnosed alongside autism

Immune and Gastrointestinal Issues:
• Higher rates of food allergies and intolerances
• Gastrointestinal problems (constipation, diarrhea)
• Immune system differences
• Increased inflammation markers in some studies
• Sleep issues may be related

Important:
• Co-occurring conditions are NOT caused by autism
• Each condition may need specific support or treatment
• Success involves addressing all conditions
• Treatment for one may help others too
• Working with multiple specialists may be needed

Getting Help:
• Communicate all concerns to doctors
• Seek specialists experienced with autism
• Consider how conditions interact
• Medication may help some conditions
• Therapy tailored to autistic needs is important
• Support from community helps

With proper support for autism AND co-occurring conditions, individuals can thrive.`
  },

  // Interventions
  {
    category: 'interventions',
    topic: 'early-intervention',
    title: 'Early Intervention Programs',
    order: 1,
    content: `Early Intervention (EI) services are available for children under 3 with developmental delays:

What is Early Intervention?
• Federally funded program (Part C of IDEA - Individuals with Disabilities Education Act)
• FREE services for eligible children under 3
• Available in all 50 US states
• Focuses on preventing further delays
• Works with families where the child spends most time

Services Include:
• Speech-language pathology
• Occupational therapy
• Physical therapy
• Developmental services
• Family support and coaching
• Assistive technology
• Coordination with community services

How to Access:
1. Contact your state's Early Intervention program
2. Request evaluation (free)
3. Evaluation determines eligibility
4. If eligible, develop Individualized Family Service Plan (IFSP)
5. Services begin based on plan

Benefits:
✓ Early support improves outcomes significantly
✓ Services provided in natural environments (home, daycare)
✓ Family-centered approach
✓ FREE in most cases
✓ Seamless transition planning to school services at age 3
✓ Helps identify needs before school

The IFSP (Individualized Family Service Plan):
• Written plan for your child's services
• Includes goals and outcomes
• Family input is essential
• Updated every 6 months
• Teams with family to develop plan
• Includes transition planning

Why Early Intervention Matters:
• Brain development is most plastic in early years
• Early support can prevent secondary delays
• Families learn strategies to support development daily
• Natural environments promote generalization
• Cost-effective long-term
• Builds parent confidence and skills

Transitioning to School Services:
• At age 3, services transition to school district
• Develop IEP (Individualized Education Program)
• May continue similar services
• More emphasis on school readiness
• Child spends more time in school setting

Don't Wait:
• If you have concerns about development, request evaluation
• Early evaluation is free - there's no downside
• Early action makes a tremendous difference
• Services are available even without formal autism diagnosis`
  },
  {
    category: 'interventions',
    topic: 'behavioral-therapy',
    title: 'Behavioral and Educational Therapies',
    order: 2,
    content: `Several evidence-based therapies help autistic individuals develop skills:

ABA (Applied Behavior Analysis):
What it is:
• Focuses on increasing desired behaviors and reducing challenging behaviors
• Uses principles of learning and reinforcement
• Structured, intensive approach
• Often 10-40 hours per week for young children

How it works:
• Break skills into small steps
• Teach one step at a time
• Use rewards and positive reinforcement
• Track progress
• Adjust based on learning

Benefits:
✓ Evidence-based and well-researched
✓ Can help with communication and social skills
✓ Reduces challenging behaviors
✓ Improves independent living skills
✓ Insurance often covers

Considerations:
• Cost can be high ($50,000-$100,000+ per year)
• Quality varies - important to find experienced, ethical providers
• Controversy about intensive ABA - some autistic adults report trauma
• Modern ABA more autism-affirming than older approaches
• Not all autistic people want or need ABA

Speech-Language Therapy:
• Improves communication skills
• Works on language understanding and expression
• Social communication coaching
• AAC (Augmentative and Alternative Communication) device training
• Eating/swallowing difficulties (if needed)

Occupational Therapy:
• Fine motor skill development
• Sensory integration
• Daily living skills (eating, dressing, hygiene)
• School-related skills
• Adaptive strategies

Physical Therapy:
• Gross motor skill development
• Balance and coordination
• Strength and endurance
• Movement patterns
• Play and recreational activities

Social Skills Groups:
• Peer interaction practice
• Understanding social rules and emotions
• Problem-solving in social situations
• Building friendships
• Small group setting

School-Based Services:
• Speech and occupational therapy at school
• Special education support
• Social skills instruction
• Modified curriculum if needed
• Behavior support plans

Key Principles of Effective Therapy:
✓ Autism-affirming approach
✓ Works on skills child/family prioritizes
✓ Generalization to multiple settings
✓ Includes family training
✓ Regular progress monitoring
✓ Flexible based on child's needs
✓ Respects autistic strengths and differences

Finding Quality Services:
• Ask for providers experienced with autism
• Request autism-affirming approaches
• Get referrals from pediatrician or school
• Ask about credentials and training
• Ensure good communication with school
• Monitor for your child's wellbeing and progress

Therapy Goals Should Include:
• Communication and social skills
• Daily living independence
• School/work success
• Managing sensory needs
• Building on strengths
• Quality of life
• Self-acceptance

Remember: The best therapy respects the child's autism while building needed skills. It's about supporting them to thrive, not making them "act normal."
`
  }
];

async function seedData() {
  try {
    const mongoUri = process.env.MONGO_URI;
    if (!mongoUri) {
      console.error('MONGO_URI not set in .env');
      process.exit(1);
    }

    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB');

    // Clear existing data
    await EducationalContent.deleteMany({});
    console.log('🗑️  Cleared existing educational content');

    // Insert new data
    const inserted = await EducationalContent.insertMany(educationalData);
    console.log(`\n✅ Successfully seeded ${inserted.length} educational content entries:\n`);
    
    inserted.forEach((item, index) => {
      console.log(`${index + 1}. [${item.category}] - ${item.title}`);
    });

    await mongoose.connection.close();
    console.log('\n✅ Database seeding complete! You can now see content in the app.');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error seeding data:', error.message);
    process.exit(1);
  }
}

seedData();