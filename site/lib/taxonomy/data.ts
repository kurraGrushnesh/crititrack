/**
 * The global professional taxonomy tree.
 *
 * Authored as nested nodes for readability; `index.ts` flattens it into
 * lookup maps. Every occupation and specialization here is a real,
 * recognised profession — nothing is invented to pad the count. Coverage
 * is deliberately deep for the areas public figures cluster in (sport,
 * screen, music, politics, business, technology, science) and broad but
 * lighter elsewhere; gaps are expected and are filled by adding data,
 * never by guessing at render time.
 *
 * Not US-only: aliases carry British, Indian, and other regional titles
 * alongside the canonical label, plus historical and emerging variants.
 */

import type { TaxonomySectorNode } from "./types";

export const TAXONOMY: TaxonomySectorNode[] = [
  // ── Technology ───────────────────────────────────────────────────
  {
    id: "technology",
    label: "Technology",
    aliases: ["Tech", "IT", "Information Technology"],
    industries: [
      {
        id: "software",
        label: "Software",
        families: [
          {
            id: "software-engineering",
            label: "Software Engineering",
            occupations: [
              {
                id: "software-engineer",
                label: "Software Engineer",
                aliases: [
                  "Software Developer",
                  "Programmer",
                  "Developer",
                  "Coder",
                  "Software Programmer",
                  "Application Developer",
                ],
                specializations: [
                  "Backend Engineer",
                  "Frontend Engineer",
                  "Full-Stack Engineer",
                  "Mobile Engineer",
                  "Embedded Systems Engineer",
                  "Systems Programmer",
                  "Game Programmer",
                  "Firmware Engineer",
                ],
              },
              {
                id: "devops-engineer",
                label: "DevOps Engineer",
                aliases: ["Platform Engineer", "Infrastructure Engineer"],
                specializations: [
                  "Site Reliability Engineer",
                  "Build Engineer",
                  "Release Engineer",
                ],
              },
              {
                id: "qa-engineer",
                label: "Quality Assurance Engineer",
                aliases: ["QA Engineer", "Test Engineer", "SDET"],
                specializations: ["Automation Tester", "Performance Tester"],
              },
              {
                id: "software-architect",
                label: "Software Architect",
                aliases: ["Solutions Architect", "Application Architect"],
                specializations: ["Enterprise Architect", "Cloud Architect"],
              },
            ],
          },
          {
            id: "product-and-design",
            label: "Product & Design",
            occupations: [
              {
                id: "product-manager",
                label: "Product Manager",
                aliases: ["PM", "Product Owner", "Technical Product Manager"],
                specializations: ["Group Product Manager", "Growth Product Manager"],
              },
              {
                id: "ux-designer",
                label: "UX Designer",
                aliases: [
                  "User Experience Designer",
                  "Product Designer",
                  "UI/UX Designer",
                  "Interaction Designer",
                ],
                specializations: ["UI Designer", "UX Researcher", "Design Systems Designer"],
              },
              {
                id: "technical-writer",
                label: "Technical Writer",
                aliases: ["Documentation Engineer", "Content Designer"],
              },
            ],
          },
        ],
      },
      {
        id: "artificial-intelligence",
        label: "Artificial Intelligence",
        aliases: ["AI", "Machine Learning", "ML", "AI/ML"],
        families: [
          {
            id: "machine-learning",
            label: "Machine Learning",
            occupations: [
              {
                id: "machine-learning-engineer",
                label: "Machine Learning Engineer",
                aliases: ["ML Engineer", "AI Engineer", "Applied ML Engineer"],
                specializations: [
                  "Computer Vision Engineer",
                  "NLP Engineer",
                  "MLOps Engineer",
                  "Recommender Systems Engineer",
                ],
              },
              {
                id: "computer-scientist",
                label: "Computer Scientist",
                aliases: ["Computing Researcher", "Theoretical Computer Scientist"],
                specializations: ["Algorithms Researcher", "Systems Researcher", "HCI Researcher", "Cryptographer"],
              },
              {
                id: "ai-researcher",
                label: "AI Researcher",
                aliases: [
                  "Machine Learning Researcher",
                  "AI Research Scientist",
                  "Research Scientist (AI)",
                  "Deep Learning Researcher",
                ],
                specializations: [
                  "NLP Researcher",
                  "Computer Vision Researcher",
                  "Reinforcement Learning Researcher",
                  "AI Safety Researcher",
                  "Generative AI Researcher",
                ],
              },
              {
                id: "research-engineer-ai",
                label: "AI Research Engineer",
                aliases: ["Research Engineer"],
              },
            ],
          },
          {
            id: "data-science",
            label: "Data Science",
            occupations: [
              {
                id: "data-scientist",
                label: "Data Scientist",
                aliases: ["Applied Scientist", "Decision Scientist"],
                specializations: ["Product Data Scientist", "Research Data Scientist"],
              },
              {
                id: "data-engineer",
                label: "Data Engineer",
                aliases: ["Big Data Engineer", "Analytics Engineer"],
              },
              {
                id: "data-analyst",
                label: "Data Analyst",
                aliases: ["Business Intelligence Analyst", "BI Analyst"],
              },
            ],
          },
        ],
      },
      {
        id: "cybersecurity",
        label: "Cybersecurity",
        aliases: ["Information Security", "InfoSec", "Cyber Security"],
        families: [
          {
            id: "security-practice",
            label: "Security Practice",
            occupations: [
              {
                id: "security-engineer",
                label: "Security Engineer",
                aliases: ["Cybersecurity Engineer", "Application Security Engineer"],
                specializations: [
                  "Penetration Tester",
                  "Red Team Operator",
                  "Blue Team Analyst",
                  "Cloud Security Engineer",
                ],
              },
              {
                id: "security-researcher",
                label: "Security Researcher",
                aliases: ["Vulnerability Researcher", "Ethical Hacker"],
                specializations: ["Malware Analyst", "Exploit Developer"],
              },
              {
                id: "security-analyst",
                label: "Security Analyst",
                aliases: ["SOC Analyst", "Threat Intelligence Analyst"],
              },
              {
                id: "ciso",
                label: "Chief Information Security Officer",
                aliases: ["CISO", "Head of Security"],
              },
            ],
          },
        ],
      },
      {
        id: "it-infrastructure",
        label: "IT & Infrastructure",
        families: [
          {
            id: "systems-and-networks",
            label: "Systems & Networks",
            occupations: [
              {
                id: "systems-administrator",
                label: "Systems Administrator",
                aliases: ["Sysadmin", "IT Administrator"],
              },
              {
                id: "network-engineer",
                label: "Network Engineer",
                aliases: ["Network Administrator", "Network Architect"],
              },
              {
                id: "database-administrator",
                label: "Database Administrator",
                aliases: ["DBA"],
              },
              { id: "it-support-specialist", label: "IT Support Specialist", aliases: ["Help Desk Technician", "Desktop Support"] },
            ],
          },
        ],
      },
      {
        id: "tech-leadership-entrepreneurship",
        label: "Technology Leadership",
        families: [
          {
            id: "tech-founders-executives",
            label: "Founders & Executives",
            occupations: [
              {
                id: "technology-entrepreneur",
                label: "Technology Entrepreneur",
                aliases: ["Tech Founder", "Startup Founder", "Tech Startup Founder"],
                specializations: ["Serial Entrepreneur", "Solo Founder"],
              },
              {
                id: "chief-technology-officer",
                label: "Chief Technology Officer",
                aliases: ["CTO"],
              },
              {
                id: "engineering-manager",
                label: "Engineering Manager",
                aliases: ["Head of Engineering", "VP of Engineering", "Director of Engineering"],
              },
            ],
          },
        ],
      },
    ],
  },

  // ── Science & Research ───────────────────────────────────────────
  {
    id: "science-research",
    label: "Science & Research",
    aliases: ["Science", "Research", "Academia"],
    industries: [
      {
        id: "physical-sciences",
        label: "Physical Sciences",
        families: [
          {
            id: "physics",
            label: "Physics",
            occupations: [
              {
                id: "physicist",
                label: "Physicist",
                aliases: ["Research Physicist"],
                specializations: [
                  "Theoretical Physicist",
                  "Particle Physicist",
                  "Astrophysicist",
                  "Condensed Matter Physicist",
                  "Quantum Physicist",
                  "Nuclear Physicist",
                ],
              },
            ],
          },
          {
            id: "chemistry",
            label: "Chemistry",
            occupations: [
              {
                id: "chemist",
                label: "Chemist",
                specializations: [
                  "Organic Chemist",
                  "Analytical Chemist",
                  "Biochemist",
                  "Materials Chemist",
                ],
              },
            ],
          },
          {
            id: "astronomy",
            label: "Astronomy & Space Science",
            occupations: [
              { id: "astronomer", label: "Astronomer", specializations: ["Observational Astronomer", "Cosmologist"] },
              {
                id: "astronaut",
                label: "Astronaut",
                aliases: ["Cosmonaut", "Spationaut", "Taikonaut"],
                specializations: ["Mission Specialist", "Payload Specialist"],
              },
            ],
          },
          {
            id: "earth-sciences",
            label: "Earth Sciences",
            occupations: [
              { id: "geologist", label: "Geologist", specializations: ["Seismologist", "Volcanologist"] },
              { id: "climatologist", label: "Climatologist", aliases: ["Climate Scientist"] },
              { id: "meteorologist", label: "Meteorologist", aliases: ["Weather Forecaster"] },
              { id: "oceanographer", label: "Oceanographer" },
            ],
          },
        ],
      },
      {
        id: "life-sciences",
        label: "Life Sciences",
        families: [
          {
            id: "biology",
            label: "Biology",
            occupations: [
              {
                id: "biologist",
                label: "Biologist",
                specializations: [
                  "Molecular Biologist",
                  "Marine Biologist",
                  "Microbiologist",
                  "Geneticist",
                  "Ecologist",
                  "Zoologist",
                  "Botanist",
                ],
              },
              { id: "neuroscientist", label: "Neuroscientist", aliases: ["Brain Scientist"] },
            ],
          },
        ],
      },
      {
        id: "mathematics",
        label: "Mathematics & Statistics",
        families: [
          {
            id: "mathematics-family",
            label: "Mathematics",
            occupations: [
              {
                id: "mathematician",
                label: "Mathematician",
                specializations: ["Applied Mathematician", "Pure Mathematician", "Number Theorist"],
              },
              { id: "statistician", label: "Statistician", aliases: ["Biostatistician"] },
            ],
          },
        ],
      },
      {
        id: "social-sciences",
        label: "Social Sciences",
        families: [
          {
            id: "social-science-family",
            label: "Social Sciences",
            occupations: [
              { id: "economist", label: "Economist", specializations: ["Macroeconomist", "Behavioural Economist", "Development Economist"] },
              { id: "psychologist", label: "Psychologist", specializations: ["Clinical Psychologist", "Cognitive Psychologist", "Social Psychologist"] },
              { id: "sociologist", label: "Sociologist" },
              { id: "anthropologist", label: "Anthropologist", specializations: ["Cultural Anthropologist", "Archaeologist"] },
              { id: "political-scientist", label: "Political Scientist" },
              { id: "historian", label: "Historian", specializations: ["Military Historian", "Art Historian", "Economic Historian"] },
            ],
          },
        ],
      },
      {
        id: "research-roles",
        label: "Research Roles",
        families: [
          {
            id: "research-family",
            label: "Research",
            occupations: [
              {
                id: "research-scientist",
                label: "Research Scientist",
                aliases: ["Scientist", "Researcher", "Principal Investigator", "Research Fellow"],
              },
              { id: "laboratory-technician", label: "Laboratory Technician", aliases: ["Lab Technician", "Research Assistant"] },
              { id: "science-communicator", label: "Science Communicator", aliases: ["Science Populariser", "Science Writer"] },
            ],
          },
        ],
      },
    ],
  },

  // ── Healthcare & Life Sciences ───────────────────────────────────
  {
    id: "healthcare",
    label: "Healthcare & Medicine",
    aliases: ["Healthcare", "Medicine", "Medical", "Health"],
    industries: [
      {
        id: "clinical-medicine",
        label: "Clinical Medicine",
        families: [
          {
            id: "physicians",
            label: "Physicians",
            occupations: [
              {
                id: "physician",
                label: "Physician",
                aliases: ["Doctor", "Medical Doctor", "MD", "Medical Practitioner", "Consultant"],
                specializations: [
                  "Cardiologist",
                  "Neurologist",
                  "Oncologist",
                  "Paediatrician",
                  "Psychiatrist",
                  "Dermatologist",
                  "Endocrinologist",
                  "Gastroenterologist",
                  "Radiologist",
                  "Anaesthesiologist",
                  "General Practitioner",
                  "Emergency Physician",
                  "Pathologist",
                  "Immunologist",
                  "Epidemiologist",
                ],
              },
              {
                id: "surgeon",
                label: "Surgeon",
                specializations: [
                  "Cardiothoracic Surgeon",
                  "Neurosurgeon",
                  "Orthopaedic Surgeon",
                  "Plastic Surgeon",
                  "Transplant Surgeon",
                  "Trauma Surgeon",
                ],
              },
            ],
          },
          {
            id: "nursing-and-allied",
            label: "Nursing & Allied Health",
            occupations: [
              { id: "nurse", label: "Nurse", aliases: ["Registered Nurse", "Nurse Practitioner"], specializations: ["ICU Nurse", "Midwife"] },
              { id: "paramedic", label: "Paramedic", aliases: ["Emergency Medical Technician", "EMT"] },
              { id: "physiotherapist", label: "Physiotherapist", aliases: ["Physical Therapist"] },
              { id: "pharmacist", label: "Pharmacist", aliases: ["Chemist (Pharmacy)"] },
              { id: "dentist", label: "Dentist", specializations: ["Orthodontist", "Oral Surgeon"] },
              { id: "psychotherapist", label: "Psychotherapist", aliases: ["Counsellor", "Therapist"] },
              { id: "veterinarian", label: "Veterinarian", aliases: ["Vet", "Veterinary Surgeon"] },
              { id: "optometrist", label: "Optometrist" },
              { id: "dietitian", label: "Dietitian", aliases: ["Nutritionist"] },
            ],
          },
        ],
      },
      {
        id: "public-health",
        label: "Public Health",
        families: [
          {
            id: "public-health-family",
            label: "Public Health",
            occupations: [
              { id: "public-health-official", label: "Public Health Official", aliases: ["Health Administrator", "Chief Medical Officer", "Surgeon General"] },
              { id: "epidemiologist-ph", label: "Epidemiologist", aliases: ["Disease Epidemiologist"] },
            ],
          },
        ],
      },
      {
        id: "pharma-biotech",
        label: "Pharmaceuticals & Biotechnology",
        aliases: ["Pharma", "Biotech", "Biotechnology", "Life Sciences Industry"],
        families: [
          {
            id: "pharma-biotech-family",
            label: "Pharma & Biotech",
            occupations: [
              { id: "pharmaceutical-scientist", label: "Pharmaceutical Scientist", aliases: ["Drug Development Scientist", "Pharmacologist"] },
              { id: "clinical-researcher", label: "Clinical Researcher", aliases: ["Clinical Trials Manager", "Clinical Research Associate"] },
              { id: "biotech-entrepreneur", label: "Biotechnology Entrepreneur", aliases: ["Biotech Founder"] },
              { id: "bioengineer", label: "Bioengineer", aliases: ["Biomedical Engineer"], specializations: ["Genetic Engineer", "Tissue Engineer"] },
            ],
          },
        ],
      },
    ],
  },

  // ── Education & Academia ─────────────────────────────────────────
  {
    id: "education",
    label: "Education & Academia",
    aliases: ["Education", "Teaching", "Academia"],
    industries: [
      {
        id: "higher-education",
        label: "Higher Education",
        families: [
          {
            id: "faculty",
            label: "Faculty & Scholars",
            occupations: [
              {
                id: "professor",
                label: "Professor",
                aliases: ["University Professor", "University Teacher", "Academic", "Faculty Member", "Lecturer", "Reader", "Associate Professor", "Assistant Professor", "Educator (Higher Ed)"],
                specializations: ["Emeritus Professor", "Visiting Professor", "Endowed Chair"],
              },
              { id: "researcher-academic", label: "Academic Researcher", aliases: ["Postdoctoral Researcher", "Research Fellow"] },
              { id: "university-administrator", label: "University Administrator", aliases: ["Vice-Chancellor", "University President", "Provost", "Dean", "Chancellor"] },
            ],
          },
        ],
      },
      {
        id: "schools",
        label: "Schools & Training",
        families: [
          {
            id: "teaching",
            label: "Teaching",
            occupations: [
              { id: "teacher", label: "Teacher", aliases: ["Schoolteacher", "Educator", "Tutor", "Instructor"], specializations: ["Primary School Teacher", "Secondary School Teacher", "Special Education Teacher"] },
              { id: "school-principal", label: "School Principal", aliases: ["Headteacher", "Headmaster", "Headmistress"] },
              { id: "education-administrator", label: "Education Administrator", aliases: ["Superintendent", "Education Officer"] },
            ],
          },
        ],
      },
    ],
  },

  // ── Business & Management ────────────────────────────────────────
  {
    id: "business",
    label: "Business & Management",
    aliases: ["Business", "Management", "Corporate", "Commerce"],
    industries: [
      {
        id: "executive-leadership",
        label: "Executive Leadership",
        families: [
          {
            id: "c-suite",
            label: "C-Suite",
            occupations: [
              {
                id: "chief-executive-officer",
                label: "Chief Executive Officer",
                aliases: ["CEO", "Chief Executive", "Managing Director", "Executive Director"],
              },
              { id: "chairperson", label: "Chairperson", aliases: ["Chairman", "Chairwoman", "Chair", "Board Chair", "Executive Chairman"] },
              { id: "chief-operating-officer", label: "Chief Operating Officer", aliases: ["COO"] },
              { id: "chief-financial-officer", label: "Chief Financial Officer", aliases: ["CFO"] },
              { id: "chief-marketing-officer", label: "Chief Marketing Officer", aliases: ["CMO"] },
              { id: "president-company", label: "President", aliases: ["Company President", "Group President"] },
              { id: "board-member", label: "Board Member", aliases: ["Non-Executive Director", "Board Director", "Trustee"] },
            ],
          },
        ],
      },
      {
        id: "entrepreneurship",
        label: "Entrepreneurship",
        families: [
          {
            id: "founders",
            label: "Founders",
            occupations: [
              {
                id: "entrepreneur",
                label: "Entrepreneur",
                aliases: ["Founder", "Co-Founder", "Business Owner", "Businessperson", "Businessman", "Businesswoman", "Industrialist", "Business Magnate", "Fashion Entrepreneur", "Media Entrepreneur"],
                specializations: ["Serial Entrepreneur", "Social Entrepreneur"],
              },
              { id: "venture-capitalist", label: "Venture Capitalist", aliases: ["VC", "Startup Investor"] },
              { id: "angel-investor", label: "Angel Investor", aliases: ["Seed Investor"] },
            ],
          },
        ],
      },
      {
        id: "management-operations",
        label: "Management & Operations",
        families: [
          {
            id: "management-family",
            label: "Management",
            occupations: [
              { id: "manager", label: "Manager", aliases: ["General Manager", "Operations Manager", "Department Head"] },
              { id: "project-manager", label: "Project Manager", aliases: ["Programme Manager", "Delivery Manager"] },
              { id: "management-consultant", label: "Management Consultant", aliases: ["Strategy Consultant", "Business Consultant", "Advisor"] },
              { id: "supply-chain-manager", label: "Supply Chain Manager", aliases: ["Logistics Manager", "Procurement Manager"] },
              { id: "human-resources-manager", label: "Human Resources Manager", aliases: ["HR Manager", "People Operations Lead", "Chief People Officer", "Recruiter", "Talent Acquisition Specialist"] },
            ],
          },
        ],
      },
      {
        id: "sales-and-marketing",
        label: "Sales, Marketing & Advertising",
        aliases: ["Marketing", "Advertising", "Sales"],
        families: [
          {
            id: "marketing-family",
            label: "Marketing & Advertising",
            occupations: [
              { id: "marketing-manager", label: "Marketing Manager", aliases: ["Brand Manager", "Growth Marketer", "Digital Marketing Manager"] },
              { id: "advertising-executive", label: "Advertising Executive", aliases: ["Ad Executive", "Account Director"] },
              { id: "copywriter", label: "Copywriter", aliases: ["Advertising Copywriter"] },
              { id: "public-relations-specialist", label: "Public Relations Specialist", aliases: ["PR Specialist", "Publicist", "Communications Manager", "Spokesperson"] },
              { id: "sales-executive", label: "Sales Executive", aliases: ["Salesperson", "Account Executive", "Sales Representative", "Business Development Manager"] },
            ],
          },
        ],
      },
      {
        id: "real-estate",
        label: "Real Estate & Property",
        families: [
          {
            id: "real-estate-family",
            label: "Real Estate",
            occupations: [
              { id: "real-estate-developer", label: "Real Estate Developer", aliases: ["Property Developer", "Land Developer"] },
              { id: "real-estate-agent", label: "Real Estate Agent", aliases: ["Estate Agent", "Realtor", "Property Broker"] },
              { id: "property-manager", label: "Property Manager" },
            ],
          },
        ],
      },
    ],
  },

  // ── Finance ─────────────────────────────────────────────────────
  {
    id: "finance",
    label: "Finance",
    aliases: ["Financial Services"],
    industries: [
      {
        id: "banking",
        label: "Banking",
        families: [
          {
            id: "banking-family",
            label: "Banking",
            occupations: [
              { id: "banker", label: "Banker", aliases: ["Commercial Banker", "Retail Banker"] },
              { id: "investment-banker", label: "Investment Banker", aliases: ["M&A Banker"] },
              { id: "central-banker", label: "Central Banker", aliases: ["Central Bank Governor", "Federal Reserve Chair", "Reserve Bank Governor"] },
            ],
          },
        ],
      },
      {
        id: "investment-management",
        label: "Investment & Asset Management",
        families: [
          {
            id: "investing-family",
            label: "Investing",
            occupations: [
              { id: "investor", label: "Investor", aliases: ["Financier", "Value Investor"], specializations: ["Institutional Investor", "Retail Investor"] },
              { id: "fund-manager", label: "Fund Manager", aliases: ["Portfolio Manager", "Asset Manager"] },
              { id: "hedge-fund-manager", label: "Hedge Fund Manager", aliases: ["Hedge Fund Founder"] },
              { id: "private-equity-investor", label: "Private Equity Investor", aliases: ["PE Partner", "Buyout Investor"] },
              { id: "trader", label: "Trader", aliases: ["Securities Trader", "Proprietary Trader", "Day Trader"] },
              { id: "financial-analyst", label: "Financial Analyst", aliases: ["Equity Analyst", "Research Analyst"] },
            ],
          },
        ],
      },
      {
        id: "accounting-advisory",
        label: "Accounting & Advisory",
        families: [
          {
            id: "accounting-family",
            label: "Accounting",
            occupations: [
              { id: "accountant", label: "Accountant", aliases: ["Chartered Accountant", "CPA", "Certified Public Accountant"] },
              { id: "auditor", label: "Auditor", aliases: ["Internal Auditor", "External Auditor"] },
              { id: "actuary", label: "Actuary" },
              { id: "financial-adviser", label: "Financial Adviser", aliases: ["Financial Advisor", "Wealth Manager", "Financial Planner"] },
            ],
          },
        ],
      },
      {
        id: "fintech-crypto",
        label: "Fintech & Digital Assets",
        aliases: ["Fintech", "Cryptocurrency", "Crypto", "Blockchain"],
        families: [
          {
            id: "fintech-family",
            label: "Fintech & Crypto",
            occupations: [
              { id: "fintech-entrepreneur", label: "Fintech Entrepreneur", aliases: ["Fintech Founder"] },
              { id: "crypto-entrepreneur", label: "Cryptocurrency Entrepreneur", aliases: ["Crypto Founder", "Blockchain Entrepreneur"] },
            ],
          },
        ],
      },
    ],
  },

  // ── Law & Legal ─────────────────────────────────────────────────
  {
    id: "law",
    label: "Law & Legal",
    aliases: ["Legal", "Justice"],
    industries: [
      {
        id: "legal-practice",
        label: "Legal Practice",
        families: [
          {
            id: "legal-practice-family",
            label: "Legal Practice",
            occupations: [
              { id: "lawyer", label: "Lawyer", aliases: ["Attorney", "Advocate", "Solicitor", "Barrister", "Counsel", "Legal Practitioner"], specializations: ["Trial Lawyer", "Corporate Lawyer", "Human Rights Lawyer", "Criminal Defence Lawyer", "Prosecutor", "Public Defender"] },
              { id: "judge", label: "Judge", aliases: ["Justice", "Magistrate", "Chief Justice", "Supreme Court Justice"] },
              { id: "legal-scholar", label: "Legal Scholar", aliases: ["Law Professor", "Jurist"] },
              { id: "notary", label: "Notary", aliases: ["Notary Public"] },
            ],
          },
        ],
      },
    ],
  },

  // ── Government & Public Service ─────────────────────────────────
  {
    id: "government-politics",
    label: "Government & Politics",
    aliases: ["Politics", "Government", "Public Service", "Public Administration"],
    industries: [
      {
        id: "elected-office",
        label: "Elected & Executive Office",
        families: [
          {
            id: "elected-office-family",
            label: "Political Office",
            occupations: [
              {
                id: "politician",
                label: "Politician",
                aliases: ["Statesman", "Stateswoman", "Political Leader", "Party Leader"],
                specializations: ["Head of State", "Head of Government", "President", "Prime Minister", "Chancellor", "Governor", "Mayor", "Legislator", "Member of Parliament", "Senator", "Congressman", "Congresswoman", "Councillor"],
              },
              { id: "cabinet-minister", label: "Cabinet Minister", aliases: ["Minister", "Secretary of State", "Union Minister", "Cabinet Secretary"] },
              { id: "civil-servant", label: "Civil Servant", aliases: ["Bureaucrat", "Government Official", "Public Administrator", "Permanent Secretary"] },
            ],
          },
        ],
      },
      {
        id: "diplomacy",
        label: "Diplomacy & International Affairs",
        aliases: ["Diplomacy", "Foreign Affairs", "International Relations"],
        families: [
          {
            id: "diplomacy-family",
            label: "Diplomacy",
            occupations: [
              { id: "diplomat", label: "Diplomat", aliases: ["Ambassador", "High Commissioner", "Consul", "Envoy", "Foreign Service Officer"] },
              { id: "international-official", label: "International Organisation Official", aliases: ["UN Official", "Secretary-General", "Commissioner"] },
            ],
          },
        ],
      },
      {
        id: "activism-advocacy",
        label: "Activism & Advocacy",
        families: [
          {
            id: "activism-family",
            label: "Activism",
            occupations: [
              { id: "activist", label: "Activist", aliases: ["Campaigner", "Advocate", "Human Rights Defender", "Civil Rights Activist", "Environmental Activist", "Climate Activist"] },
              { id: "lobbyist", label: "Lobbyist", aliases: ["Government Affairs Consultant"] },
              { id: "community-organiser", label: "Community Organiser", aliases: ["Community Organizer"] },
            ],
          },
        ],
      },
    ],
  },

  // ── Military, Defence & Security ────────────────────────────────
  {
    id: "military-security",
    label: "Military, Defence & Security",
    aliases: ["Military", "Armed Forces", "Defence", "Defense", "Law Enforcement", "Police"],
    industries: [
      {
        id: "armed-forces",
        label: "Armed Forces",
        families: [
          {
            id: "armed-forces-family",
            label: "Armed Forces",
            occupations: [
              { id: "military-officer", label: "Military Officer", aliases: ["Army Officer", "Naval Officer", "Air Force Officer", "General", "Admiral", "Colonel", "Commander", "Field Marshal", "Marshal"] },
              { id: "soldier", label: "Soldier", aliases: ["Serviceman", "Servicewoman", "Marine", "Infantryman"] },
              { id: "military-pilot", label: "Military Pilot", aliases: ["Fighter Pilot", "Combat Pilot"] },
              { id: "special-forces-operator", label: "Special Forces Operator", aliases: ["Commando", "Navy SEAL", "Paratrooper"] },
            ],
          },
        ],
      },
      {
        id: "policing-intelligence",
        label: "Policing & Intelligence",
        families: [
          {
            id: "policing-family",
            label: "Policing & Intelligence",
            occupations: [
              { id: "police-officer", label: "Police Officer", aliases: ["Constable", "Detective", "Police Chief", "Commissioner of Police", "Superintendent"] },
              { id: "intelligence-officer", label: "Intelligence Officer", aliases: ["Spy", "Intelligence Analyst", "Agent"] },
              { id: "firefighter", label: "Firefighter", aliases: ["Fire Officer", "Fireman"] },
            ],
          },
        ],
      },
    ],
  },

  // ── Media & Journalism ─────────────────────────────────────────
  {
    id: "media-journalism",
    label: "Media & Journalism",
    aliases: ["Media", "Press", "News", "Journalism"],
    industries: [
      {
        id: "journalism",
        label: "Journalism",
        families: [
          {
            id: "journalism-family",
            label: "Journalism",
            occupations: [
              {
                id: "journalist",
                label: "Journalist",
                aliases: ["Reporter", "Correspondent", "News Reporter", "Newsperson"],
                specializations: ["Investigative Journalist", "War Correspondent", "Political Reporter", "Sports Journalist", "Business Journalist", "Photojournalist", "Data Journalist"],
              },
              { id: "news-anchor", label: "News Anchor", aliases: ["News Presenter", "Newsreader", "Anchor"] },
              { id: "editor", label: "Editor", aliases: ["Editor-in-Chief", "Managing Editor", "News Editor", "Commissioning Editor"] },
              { id: "columnist", label: "Columnist", aliases: ["Opinion Writer", "Op-ed Writer", "Commentator", "Pundit", "Political Writer", "Political Commentator"] },
              { id: "media-executive", label: "Media Executive", aliases: ["Media Proprietor", "Media Mogul", "Publisher", "Press Baron"] },
            ],
          },
        ],
      },
      {
        id: "broadcasting",
        label: "Broadcasting & Presenting",
        families: [
          {
            id: "broadcasting-family",
            label: "Broadcasting",
            occupations: [
              { id: "television-presenter", label: "Television Presenter", aliases: ["TV Host", "Presenter", "Talk Show Host", "Game Show Host"] },
              { id: "radio-presenter", label: "Radio Presenter", aliases: ["Radio Host", "Radio DJ", "Broadcaster", "Radio Jockey"] },
              { id: "sports-commentator", label: "Sports Commentator", aliases: ["Sports Broadcaster", "Colour Commentator", "Sports Pundit"] },
            ],
          },
        ],
      },
    ],
  },

  // ── Film & Television ─────────────────────────────────────────
  {
    id: "film-tv",
    label: "Film & Television",
    aliases: ["Cinema", "Movies", "Entertainment", "Screen", "Film Industry"],
    industries: [
      {
        id: "screen-performance",
        label: "Screen Performance",
        families: [
          {
            id: "acting",
            label: "Acting",
            occupations: [
              {
                id: "actor",
                label: "Actor",
                aliases: ["Actress", "Film Actor", "Television Actor", "Screen Actor", "Movie Star", "Film Star"],
                specializations: ["Character Actor", "Voice Actor", "Stunt Performer", "Child Actor", "Method Actor"],
              },
            ],
          },
        ],
      },
      {
        id: "filmmaking",
        label: "Filmmaking & Production",
        families: [
          {
            id: "filmmaking-family",
            label: "Filmmaking",
            occupations: [
              { id: "film-director", label: "Film Director", aliases: ["Director", "Movie Director", "Filmmaker"], specializations: ["Documentary Director", "Television Director"] },
              { id: "film-producer", label: "Film Producer", aliases: ["Producer", "Executive Producer", "Movie Producer"] },
              { id: "screenwriter", label: "Screenwriter", aliases: ["Scriptwriter", "Screenplay Writer"] },
              { id: "cinematographer", label: "Cinematographer", aliases: ["Director of Photography", "DoP"] },
              { id: "film-editor", label: "Film Editor", aliases: ["Editor (Film)"] },
              { id: "casting-director", label: "Casting Director" },
              { id: "production-designer", label: "Production Designer", aliases: ["Art Director"] },
              { id: "costume-designer", label: "Costume Designer" },
              { id: "visual-effects-artist", label: "Visual Effects Artist", aliases: ["VFX Artist", "CGI Artist", "Animator"] },
            ],
          },
        ],
      },
    ],
  },

  // ── Music & Performing Arts ───────────────────────────────────
  {
    id: "music-performing-arts",
    label: "Music & Performing Arts",
    aliases: ["Music", "Performing Arts", "Entertainment (Music)"],
    industries: [
      {
        id: "music",
        label: "Music",
        families: [
          {
            id: "music-performance",
            label: "Music Performance & Writing",
            occupations: [
              {
                id: "singer",
                label: "Singer",
                aliases: ["Vocalist", "Recording Artist", "Singer-Songwriter", "Pop Star"],
                specializations: ["Opera Singer", "Playback Singer", "Backing Vocalist"],
              },
              { id: "musician", label: "Musician", aliases: ["Instrumentalist", "Session Musician", "Performing Artist"], specializations: ["Guitarist", "Pianist", "Drummer", "Bassist", "Violinist", "Cellist", "Saxophonist"] },
              { id: "songwriter", label: "Songwriter", aliases: ["Composer", "Lyricist", "Tunesmith"] },
              { id: "rapper", label: "Rapper", aliases: ["MC", "Hip Hop Artist", "Emcee"] },
              { id: "record-producer", label: "Record Producer", aliases: ["Music Producer", "Beatmaker"] },
              { id: "dj", label: "DJ", aliases: ["Disc Jockey", "Club DJ", "Electronic Music Producer"] },
              { id: "conductor", label: "Conductor", aliases: ["Orchestral Conductor", "Maestro", "Music Director"] },
              { id: "composer-classical", label: "Composer", aliases: ["Classical Composer", "Film Score Composer", "Film Composer"] },
            ],
          },
          {
            id: "music-business",
            label: "Music Business",
            occupations: [
              { id: "music-executive", label: "Music Executive", aliases: ["Record Label Executive", "A&R Executive", "Music Manager"] },
            ],
          },
        ],
      },
      {
        id: "stage-and-dance",
        label: "Stage & Dance",
        families: [
          {
            id: "stage-dance-family",
            label: "Stage & Dance",
            occupations: [
              { id: "dancer", label: "Dancer", aliases: ["Ballet Dancer", "Choreographer", "Ballerina"] },
              { id: "theatre-actor", label: "Theatre Actor", aliases: ["Stage Actor", "Broadway Performer"] },
              { id: "theatre-director", label: "Theatre Director", aliases: ["Stage Director"] },
              { id: "comedian", label: "Comedian", aliases: ["Stand-up Comedian", "Comic", "Humourist"] },
              { id: "magician", label: "Magician", aliases: ["Illusionist"] },
              { id: "circus-performer", label: "Circus Performer", aliases: ["Acrobat", "Trapeze Artist"] },
            ],
          },
        ],
      },
    ],
  },

  // ── Arts, Design & Architecture ──────────────────────────────
  {
    id: "arts-design",
    label: "Arts, Design & Architecture",
    aliases: ["Art", "Visual Arts", "Design", "Architecture"],
    industries: [
      {
        id: "visual-arts",
        label: "Visual Arts",
        families: [
          {
            id: "visual-arts-family",
            label: "Visual Arts",
            occupations: [
              { id: "artist", label: "Artist", aliases: ["Visual Artist", "Fine Artist", "Painter", "Sculptor", "Contemporary Artist"], specializations: ["Portrait Painter", "Street Artist", "Muralist", "Installation Artist", "Conceptual Artist"] },
              { id: "photographer", label: "Photographer", aliases: ["Portrait Photographer", "Fashion Photographer", "Wildlife Photographer", "Documentary Photographer"] },
              { id: "illustrator", label: "Illustrator", aliases: ["Comic Artist", "Cartoonist", "Concept Artist"] },
              { id: "sculptor", label: "Sculptor" },
              { id: "curator", label: "Curator", aliases: ["Museum Curator", "Art Curator", "Gallerist"] },
            ],
          },
        ],
      },
      {
        id: "design",
        label: "Design",
        families: [
          {
            id: "design-family",
            label: "Design",
            occupations: [
              { id: "graphic-designer", label: "Graphic Designer", aliases: ["Visual Designer", "Brand Designer"] },
              { id: "industrial-designer", label: "Industrial Designer", aliases: ["Product Designer (Industrial)"] },
              { id: "interior-designer", label: "Interior Designer", aliases: ["Interior Decorator"] },
              { id: "game-designer", label: "Game Designer", aliases: ["Video Game Designer", "Level Designer"] },
            ],
          },
        ],
      },
      {
        id: "architecture",
        label: "Architecture",
        families: [
          {
            id: "architecture-family",
            label: "Architecture",
            occupations: [
              { id: "architect", label: "Architect", specializations: ["Landscape Architect", "Urban Planner", "Restoration Architect"] },
            ],
          },
        ],
      },
      {
        id: "literature",
        label: "Writing & Literature",
        aliases: ["Literature", "Publishing", "Writing"],
        families: [
          {
            id: "literature-family",
            label: "Writing & Literature",
            occupations: [
              {
                id: "writer",
                label: "Writer",
                aliases: ["Author", "Novelist", "Wordsmith", "Autobiographer", "Memoirist", "Prose Writer"],
                specializations: ["Novelist", "Poet", "Playwright", "Essayist", "Short Story Writer", "Children's Author", "Science Fiction Author", "Non-fiction Author", "Ghostwriter", "Biographer"],
              },
              { id: "book-editor", label: "Book Editor", aliases: ["Literary Editor", "Publishing Editor"] },
              { id: "literary-critic", label: "Literary Critic", aliases: ["Book Critic", "Reviewer"] },
              { id: "translator", label: "Translator", aliases: ["Literary Translator", "Interpreter"] },
              { id: "publisher-book", label: "Publisher", aliases: ["Book Publisher", "Publishing Executive"] },
            ],
          },
        ],
      },
    ],
  },

  // ── Fashion & Beauty ────────────────────────────────────────
  {
    id: "fashion-beauty",
    label: "Fashion & Beauty",
    aliases: ["Fashion", "Beauty", "Style", "Cosmetics"],
    industries: [
      {
        id: "fashion",
        label: "Fashion",
        families: [
          {
            id: "fashion-family",
            label: "Fashion",
            occupations: [
              { id: "fashion-designer", label: "Fashion Designer", aliases: ["Couturier", "Clothing Designer"] },
              { id: "model", label: "Model", aliases: ["Fashion Model", "Supermodel", "Runway Model"] },
              { id: "fashion-editor", label: "Fashion Editor", aliases: ["Style Editor", "Fashion Journalist"] },
              { id: "stylist", label: "Stylist", aliases: ["Fashion Stylist", "Wardrobe Stylist", "Celebrity Stylist"] },
            ],
          },
        ],
      },
      {
        id: "beauty",
        label: "Beauty & Grooming",
        families: [
          {
            id: "beauty-family",
            label: "Beauty",
            occupations: [
              { id: "makeup-artist", label: "Makeup Artist", aliases: ["MUA", "Special Effects Makeup Artist"] },
              { id: "hairstylist", label: "Hairstylist", aliases: ["Hairdresser", "Hair Stylist", "Barber"] },
              { id: "beauty-entrepreneur", label: "Beauty Entrepreneur", aliases: ["Cosmetics Founder", "Beauty Brand Founder"] },
            ],
          },
        ],
      },
    ],
  },

  // ── Sports & Athletics ──────────────────────────────────────
  {
    id: "sports",
    label: "Sports & Athletics",
    aliases: ["Sport", "Athletics", "Sports"],
    industries: [
      {
        id: "team-sports",
        label: "Team Sports",
        families: [
          {
            id: "football-soccer",
            label: "Association Football",
            occupations: [
              { id: "footballer", label: "Footballer", aliases: ["Soccer Player", "Association Football Player", "Football Player (Soccer)"], specializations: ["Forward", "Midfielder", "Defender", "Goalkeeper", "Winger", "Striker"] },
            ],
          },
          {
            id: "cricket",
            label: "Cricket",
            occupations: [
              { id: "cricketer", label: "Cricketer", aliases: ["Cricket Player"], specializations: ["Batter", "Batsman", "Bowler", "Fast Bowler", "Spin Bowler", "All-rounder", "Wicketkeeper", "Cricket Captain"] },
            ],
          },
          {
            id: "basketball",
            label: "Basketball",
            occupations: [
              { id: "basketball-player", label: "Basketball Player", specializations: ["Point Guard", "Shooting Guard", "Small Forward", "Power Forward", "Centre"] },
            ],
          },
          {
            id: "american-football",
            label: "American Football",
            occupations: [
              { id: "american-football-player", label: "American Football Player", aliases: ["NFL Player", "Gridiron Footballer"], specializations: ["Quarterback", "Running Back", "Wide Receiver", "Linebacker"] },
            ],
          },
          {
            id: "other-team-sports",
            label: "Other Team Sports",
            occupations: [
              { id: "rugby-player", label: "Rugby Player", aliases: ["Rugby Union Player", "Rugby League Player"] },
              { id: "baseball-player", label: "Baseball Player", specializations: ["Pitcher", "Catcher", "Outfielder", "Infielder"] },
              { id: "ice-hockey-player", label: "Ice Hockey Player", aliases: ["Hockey Player (Ice)"] },
              { id: "field-hockey-player", label: "Field Hockey Player", aliases: ["Hockey Player (Field)"] },
              { id: "volleyball-player", label: "Volleyball Player" },
            ],
          },
        ],
      },
      {
        id: "individual-sports",
        label: "Individual Sports",
        families: [
          {
            id: "general-athletics",
            label: "General",
            occupations: [
              { id: "athlete", label: "Athlete", aliases: ["Sportsperson", "Sportsman", "Sportswoman", "Sports Competitor"], specializations: ["Olympian", "Paralympian"] },
            ],
          },
          {
            id: "racket-sports",
            label: "Racket Sports",
            occupations: [
              { id: "tennis-player", label: "Tennis Player", aliases: ["Professional Tennis Player"] },
              { id: "badminton-player", label: "Badminton Player" },
              { id: "table-tennis-player", label: "Table Tennis Player", aliases: ["Ping Pong Player"] },
              { id: "squash-player", label: "Squash Player" },
            ],
          },
          {
            id: "athletics-track",
            label: "Athletics",
            occupations: [
              { id: "athlete-track-field", label: "Track and Field Athlete", aliases: ["Sprinter", "Runner", "Long-distance Runner", "Marathon Runner", "Jumper", "Thrower", "Athletics Competitor"], specializations: ["Sprinter", "Middle-distance Runner", "Long-distance Runner", "Marathoner", "High Jumper", "Long Jumper", "Javelin Thrower", "Shot Putter", "Pole Vaulter", "Hurdler"] },
            ],
          },
          {
            id: "combat-sports",
            label: "Combat Sports",
            occupations: [
              { id: "boxer", label: "Boxer", aliases: ["Professional Boxer", "Prizefighter"] },
              { id: "mixed-martial-artist", label: "Mixed Martial Artist", aliases: ["MMA Fighter", "UFC Fighter"] },
              { id: "wrestler", label: "Wrestler", aliases: ["Professional Wrestler", "Freestyle Wrestler"] },
              { id: "martial-artist", label: "Martial Artist", aliases: ["Judoka", "Karateka", "Taekwondo Practitioner"] },
              { id: "fencer", label: "Fencer" },
            ],
          },
          {
            id: "other-individual-sports",
            label: "Other Individual Sports",
            occupations: [
              { id: "golfer", label: "Golfer", aliases: ["Professional Golfer"] },
              { id: "swimmer", label: "Swimmer", aliases: ["Competitive Swimmer"] },
              { id: "gymnast", label: "Gymnast", aliases: ["Artistic Gymnast", "Rhythmic Gymnast"] },
              { id: "cyclist", label: "Cyclist", aliases: ["Racing Cyclist", "Road Cyclist", "Track Cyclist"] },
              { id: "figure-skater", label: "Figure Skater" },
              { id: "alpine-skier", label: "Alpine Skier", aliases: ["Skier", "Downhill Skier"] },
              { id: "snowboarder", label: "Snowboarder" },
              { id: "surfer", label: "Surfer", aliases: ["Professional Surfer"] },
              { id: "climber", label: "Climber", aliases: ["Rock Climber", "Mountaineer", "Alpinist"] },
              { id: "weightlifter", label: "Weightlifter", aliases: ["Olympic Weightlifter", "Powerlifter"] },
              { id: "equestrian", label: "Equestrian", aliases: ["Horse Rider", "Show Jumper", "Jockey"] },
              { id: "archer", label: "Archer" },
              { id: "shooter-sport", label: "Sport Shooter", aliases: ["Marksman"] },
              { id: "chess-player", label: "Chess Player", aliases: ["Chess Grandmaster", "Chess Master"] },
              { id: "darts-player", label: "Darts Player" },
              { id: "snooker-player", label: "Snooker Player", aliases: ["Pool Player", "Billiards Player"] },
            ],
          },
        ],
      },
      {
        id: "motorsport",
        label: "Motorsport",
        families: [
          {
            id: "motorsport-family",
            label: "Motorsport",
            occupations: [
              { id: "racing-driver", label: "Racing Driver", aliases: ["Racecar Driver", "Formula One Driver", "F1 Driver", "Rally Driver", "NASCAR Driver", "Auto Racer"] },
              { id: "motorcycle-racer", label: "Motorcycle Racer", aliases: ["MotoGP Rider", "Motorbike Racer"] },
            ],
          },
        ],
      },
      {
        id: "sport-support",
        label: "Coaching & Officiating",
        families: [
          {
            id: "sport-support-family",
            label: "Coaching, Management & Officiating",
            occupations: [
              { id: "coach", label: "Coach", aliases: ["Head Coach", "Manager (Sport)", "Team Manager", "Trainer"], specializations: ["Football Manager", "Cricket Coach", "Athletics Coach", "Assistant Coach"] },
              { id: "referee", label: "Referee", aliases: ["Umpire", "Match Official"] },
              { id: "sports-administrator", label: "Sports Administrator", aliases: ["Sports Executive", "Club Owner", "Federation President"] },
              { id: "sports-agent", label: "Sports Agent" },
            ],
          },
        ],
      },
    ],
  },

  // ── Gaming, Esports & Content ───────────────────────────────
  {
    id: "gaming-content",
    label: "Gaming, Esports & Content",
    aliases: ["Gaming", "Esports", "Streaming", "Content Creation", "Digital Media"],
    industries: [
      {
        id: "esports-gaming",
        label: "Esports & Gaming",
        families: [
          {
            id: "esports-family",
            label: "Esports",
            occupations: [
              { id: "esports-player", label: "Esports Player", aliases: ["Professional Gamer", "Pro Gamer", "Competitive Gamer", "Esports Athlete"] },
              { id: "game-streamer", label: "Game Streamer", aliases: ["Twitch Streamer", "Live Streamer", "Gaming Content Creator"] },
              { id: "esports-coach", label: "Esports Coach", aliases: ["Esports Analyst", "Esports Manager"] },
              { id: "video-game-developer", label: "Video Game Developer", aliases: ["Game Developer", "Games Programmer", "Indie Game Developer"] },
            ],
          },
        ],
      },
      {
        id: "online-creation",
        label: "Online Content Creation",
        families: [
          {
            id: "creator-family",
            label: "Creators & Influencers",
            occupations: [
              {
                id: "content-creator",
                label: "Content Creator",
                aliases: ["Online Video Creator", "Digital Creator", "Internet Personality", "Web Personality"],
                specializations: ["Vlogger", "Educational Creator", "Comedy Creator", "Lifestyle Creator", "Tech Creator"],
              },
              { id: "youtuber", label: "YouTuber", aliases: ["YouTube Creator", "YouTube Personality"] },
              { id: "podcaster", label: "Podcaster", aliases: ["Podcast Host"] },
              { id: "social-media-influencer", label: "Social Media Influencer", aliases: ["Influencer", "Instagram Influencer", "TikToker", "TikTok Creator"] },
              { id: "blogger", label: "Blogger", aliases: ["Web Writer"] },
            ],
          },
        ],
      },
    ],
  },

  // ── Engineering & Built Environment ────────────────────────
  {
    id: "engineering",
    label: "Engineering & Built Environment",
    aliases: ["Engineering", "Construction", "Infrastructure"],
    industries: [
      {
        id: "core-engineering",
        label: "Core Engineering",
        families: [
          {
            id: "core-engineering-family",
            label: "Engineering Disciplines",
            occupations: [
              { id: "engineer", label: "Engineer", aliases: ["Professional Engineer", "Chartered Engineer"] },
              { id: "civil-engineer", label: "Civil Engineer", specializations: ["Structural Engineer", "Geotechnical Engineer", "Transportation Engineer"] },
              { id: "mechanical-engineer", label: "Mechanical Engineer", specializations: ["Automotive Engineer", "HVAC Engineer"] },
              { id: "electrical-engineer", label: "Electrical Engineer", specializations: ["Power Systems Engineer", "Electronics Engineer"] },
              { id: "chemical-engineer", label: "Chemical Engineer", specializations: ["Process Engineer", "Petroleum Engineer"] },
              { id: "aerospace-engineer", label: "Aerospace Engineer", aliases: ["Aeronautical Engineer"], specializations: ["Propulsion Engineer", "Avionics Engineer", "Rocket Scientist"] },
              { id: "environmental-engineer", label: "Environmental Engineer" },
              { id: "industrial-engineer", label: "Industrial Engineer", aliases: ["Manufacturing Engineer"] },
            ],
          },
        ],
      },
      {
        id: "construction",
        label: "Construction & Skilled Building",
        families: [
          {
            id: "construction-family",
            label: "Construction",
            occupations: [
              { id: "construction-manager", label: "Construction Manager", aliases: ["Site Manager", "Building Contractor", "General Contractor"] },
              { id: "quantity-surveyor", label: "Quantity Surveyor", aliases: ["Cost Engineer"] },
              { id: "surveyor", label: "Surveyor", aliases: ["Land Surveyor", "Building Surveyor"] },
            ],
          },
        ],
      },
    ],
  },

  // ── Skilled Trades & Services ──────────────────────────────
  {
    id: "skilled-trades",
    label: "Skilled Trades & Services",
    aliases: ["Trades", "Vocational", "Craft", "Manual Trades"],
    industries: [
      {
        id: "building-trades",
        label: "Building Trades",
        families: [
          {
            id: "building-trades-family",
            label: "Building Trades",
            occupations: [
              { id: "electrician", label: "Electrician" },
              { id: "plumber", label: "Plumber" },
              { id: "carpenter", label: "Carpenter", aliases: ["Joiner", "Cabinetmaker"] },
              { id: "welder", label: "Welder" },
              { id: "mason", label: "Mason", aliases: ["Bricklayer", "Stonemason"] },
              { id: "painter-decorator", label: "Painter and Decorator" },
              { id: "hvac-technician", label: "HVAC Technician", aliases: ["Air Conditioning Technician"] },
            ],
          },
        ],
      },
      {
        id: "personal-and-repair-services",
        label: "Personal & Repair Services",
        families: [
          {
            id: "services-family",
            label: "Services",
            occupations: [
              { id: "mechanic", label: "Mechanic", aliases: ["Auto Mechanic", "Car Mechanic", "Automotive Technician"] },
              { id: "chef", label: "Chef", aliases: ["Head Chef", "Executive Chef", "Cook", "Pastry Chef", "Restaurateur"], specializations: ["Sous Chef", "Pastry Chef", "Private Chef", "Celebrity Chef"] },
              { id: "tailor", label: "Tailor", aliases: ["Seamstress", "Dressmaker"] },
              { id: "jeweller", label: "Jeweller", aliases: ["Jeweler", "Goldsmith", "Watchmaker"] },
              { id: "florist", label: "Florist" },
            ],
          },
        ],
      },
    ],
  },

  // ── Manufacturing & Industry ──────────────────────────────
  {
    id: "manufacturing-industry",
    label: "Manufacturing & Industry",
    aliases: ["Manufacturing", "Industry", "Production", "Automotive"],
    industries: [
      {
        id: "manufacturing-family-industry",
        label: "Manufacturing",
        families: [
          {
            id: "manufacturing-roles",
            label: "Manufacturing Roles",
            occupations: [
              { id: "factory-worker", label: "Factory Worker", aliases: ["Production Worker", "Assembly Line Worker", "Machine Operator"] },
              { id: "production-manager", label: "Production Manager", aliases: ["Plant Manager", "Factory Manager"] },
              { id: "industrialist-manufacturing", label: "Industrialist", aliases: ["Manufacturing Magnate", "Automobile Manufacturer"] },
            ],
          },
        ],
      },
    ],
  },

  // ── Transportation & Logistics ────────────────────────────
  {
    id: "transportation",
    label: "Transportation & Logistics",
    aliases: ["Transport", "Logistics", "Aviation", "Maritime", "Shipping"],
    industries: [
      {
        id: "aviation-aerospace",
        label: "Aviation & Aerospace",
        families: [
          {
            id: "aviation-family",
            label: "Aviation",
            occupations: [
              { id: "airline-pilot", label: "Airline Pilot", aliases: ["Pilot", "Commercial Pilot", "Aviator", "Captain (Aviation)"] },
              { id: "flight-attendant", label: "Flight Attendant", aliases: ["Cabin Crew", "Air Steward", "Air Hostess"] },
              { id: "air-traffic-controller", label: "Air Traffic Controller" },
              { id: "test-pilot", label: "Test Pilot" },
            ],
          },
        ],
      },
      {
        id: "ground-and-sea-transport",
        label: "Ground & Sea Transport",
        families: [
          {
            id: "transport-family",
            label: "Ground & Sea Transport",
            occupations: [
              { id: "ship-captain", label: "Ship Captain", aliases: ["Sea Captain", "Merchant Mariner", "Master Mariner"] },
              { id: "sailor", label: "Sailor", aliases: ["Seafarer", "Mariner"] },
              { id: "train-driver", label: "Train Driver", aliases: ["Locomotive Engineer", "Railway Engineer (Driver)"] },
              { id: "truck-driver", label: "Truck Driver", aliases: ["Lorry Driver", "HGV Driver"] },
              { id: "logistics-manager", label: "Logistics Manager", aliases: ["Fleet Manager", "Distribution Manager"] },
            ],
          },
        ],
      },
    ],
  },

  // ── Agriculture, Environment & Energy ─────────────────────
  {
    id: "agriculture-environment-energy",
    label: "Agriculture, Environment & Energy",
    aliases: ["Agriculture", "Farming", "Environment", "Energy", "Mining", "Food Production"],
    industries: [
      {
        id: "agriculture",
        label: "Agriculture & Food Production",
        families: [
          {
            id: "agriculture-family",
            label: "Agriculture",
            occupations: [
              { id: "farmer", label: "Farmer", aliases: ["Agriculturalist", "Grower", "Rancher", "Cattle Rancher"], specializations: ["Dairy Farmer", "Crop Farmer", "Organic Farmer"] },
              { id: "agronomist", label: "Agronomist", aliases: ["Agricultural Scientist"] },
              { id: "fisher", label: "Fisher", aliases: ["Fisherman", "Commercial Fisher"] },
              { id: "winemaker", label: "Winemaker", aliases: ["Vintner", "Oenologist"] },
            ],
          },
        ],
      },
      {
        id: "environment-conservation",
        label: "Environment & Conservation",
        families: [
          {
            id: "environment-family",
            label: "Environment & Conservation",
            occupations: [
              { id: "conservationist", label: "Conservationist", aliases: ["Wildlife Conservationist", "Environmentalist"] },
              { id: "environmental-scientist", label: "Environmental Scientist", aliases: ["Ecologist (Applied)"] },
              { id: "park-ranger", label: "Park Ranger", aliases: ["Forest Ranger", "Wildlife Ranger"] },
            ],
          },
        ],
      },
      {
        id: "energy-mining",
        label: "Energy & Mining",
        families: [
          {
            id: "energy-family",
            label: "Energy & Mining",
            occupations: [
              { id: "energy-executive", label: "Energy Executive", aliases: ["Oil Executive", "Renewable Energy Entrepreneur"] },
              { id: "petroleum-engineer", label: "Petroleum Engineer", aliases: ["Oil and Gas Engineer"] },
              { id: "miner", label: "Miner", aliases: ["Mining Engineer", "Mineworker"] },
            ],
          },
        ],
      },
    ],
  },

  // ── Hospitality, Tourism & Retail ────────────────────────
  {
    id: "hospitality-retail",
    label: "Hospitality, Tourism & Retail",
    aliases: ["Hospitality", "Tourism", "Travel", "Retail", "Food Service"],
    industries: [
      {
        id: "hospitality",
        label: "Hospitality & Tourism",
        families: [
          {
            id: "hospitality-family",
            label: "Hospitality & Tourism",
            occupations: [
              { id: "hotelier", label: "Hotelier", aliases: ["Hotel Manager", "Hospitality Entrepreneur"] },
              { id: "restaurateur", label: "Restaurateur", aliases: ["Restaurant Owner"] },
              { id: "sommelier", label: "Sommelier", aliases: ["Wine Steward"] },
              { id: "bartender", label: "Bartender", aliases: ["Mixologist"] },
              { id: "tour-guide", label: "Tour Guide", aliases: ["Travel Guide"] },
              { id: "travel-writer", label: "Travel Writer", aliases: ["Travel Blogger"] },
            ],
          },
        ],
      },
      {
        id: "retail",
        label: "Retail & Consumer",
        families: [
          {
            id: "retail-family",
            label: "Retail",
            occupations: [
              { id: "retail-executive", label: "Retail Executive", aliases: ["Retailer", "Retail Magnate", "Department Store Owner"] },
              { id: "shopkeeper", label: "Shopkeeper", aliases: ["Retail Manager", "Store Manager", "Merchant"] },
            ],
          },
        ],
      },
    ],
  },

  // ── Social Impact & Community ────────────────────────────
  {
    id: "social-impact",
    label: "Social Impact & Community",
    aliases: ["NGO", "Nonprofit", "Non-profit", "Charity", "Social Services", "Humanitarian"],
    industries: [
      {
        id: "nonprofit-humanitarian",
        label: "Nonprofit & Humanitarian",
        families: [
          {
            id: "nonprofit-family",
            label: "Nonprofit & Humanitarian",
            occupations: [
              { id: "nonprofit-leader", label: "Nonprofit Leader", aliases: ["NGO Director", "Charity Chief Executive", "Foundation President", "Executive Director (Nonprofit)"] },
              { id: "humanitarian-worker", label: "Humanitarian Worker", aliases: ["Aid Worker", "Relief Worker", "Development Worker"] },
              { id: "philanthropist", label: "Philanthropist", aliases: ["Benefactor", "Donor"] },
            ],
          },
        ],
      },
      {
        id: "social-care-and-faith",
        label: "Social Care, Faith & Thought",
        families: [
          {
            id: "social-care-family",
            label: "Social Care",
            occupations: [
              { id: "social-worker", label: "Social Worker", aliases: ["Caseworker", "Child Protection Worker"] },
              { id: "religious-leader", label: "Religious Leader", aliases: ["Clergy", "Priest", "Pastor", "Imam", "Rabbi", "Monk", "Bishop", "Cardinal", "Pope", "Guru", "Spiritual Leader", "Preacher"] },
              { id: "philosopher", label: "Philosopher", aliases: ["Ethicist", "Public Intellectual", "Theologian"] },
            ],
          },
        ],
      },
    ],
  },

  // ── Other / Historical / Emerging ────────────────────────
  {
    id: "other",
    label: "Other, Historical & Emerging",
    aliases: ["Miscellaneous", "Other"],
    industries: [
      {
        id: "emerging-professions",
        label: "Emerging & Future Professions",
        families: [
          {
            id: "emerging-family",
            label: "Emerging Roles",
            occupations: [
              { id: "prompt-engineer", label: "Prompt Engineer", aliases: ["AI Prompt Designer"] },
              { id: "ai-ethicist", label: "AI Ethicist", aliases: ["Responsible AI Lead"] },
              { id: "sustainability-officer", label: "Chief Sustainability Officer", aliases: ["Sustainability Manager", "ESG Lead"] },
              { id: "space-entrepreneur", label: "Space Entrepreneur", aliases: ["Commercial Spaceflight Founder"] },
              { id: "creator-economy-entrepreneur", label: "Creator Economy Entrepreneur" },
            ],
          },
        ],
      },
      {
        id: "historical-professions",
        label: "Historical Professions",
        families: [
          {
            id: "historical-family",
            label: "Historical Roles",
            occupations: [
              { id: "monarch", label: "Monarch", aliases: ["King", "Queen", "Emperor", "Empress", "Sovereign", "Tsar", "Sultan", "Maharaja", "Pharaoh"] },
              { id: "noble", label: "Noble", aliases: ["Aristocrat", "Duke", "Duchess", "Earl", "Baron", "Lord", "Lady", "Count", "Countess", "Prince", "Princess"] },
              { id: "explorer", label: "Explorer", aliases: ["Adventurer", "Pioneer", "Navigator (Historical)"] },
              { id: "inventor", label: "Inventor", aliases: ["Innovator"] },
            ],
          },
        ],
      },
      {
        id: "uncategorised",
        label: "Uncategorised",
        families: [
          {
            id: "uncategorised-family",
            label: "Uncategorised",
            occupations: [
              { id: "public-figure", label: "Public Figure", aliases: ["Celebrity", "Notable Person", "Personality", "Socialite"] },
            ],
          },
        ],
      },
    ],
  },
];
