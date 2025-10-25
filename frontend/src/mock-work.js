// Mock data for Work Module - Organizations & Professional Profiles
// Following WORK_MODULE_API.md structure

// Work Role Types
export const WorkRoleTypes = {
  CEO: 'CEO',
  CTO: 'CTO',
  CFO: 'CFO',
  COO: 'COO',
  FOUNDER: 'FOUNDER',
  CO_FOUNDER: 'CO_FOUNDER',
  PRESIDENT: 'PRESIDENT',
  VICE_PRESIDENT: 'VICE_PRESIDENT',
  DIRECTOR: 'DIRECTOR',
  MANAGER: 'MANAGER',
  SENIOR_MANAGER: 'SENIOR_MANAGER',
  TEAM_LEAD: 'TEAM_LEAD',
  EMPLOYEE: 'EMPLOYEE',
  SENIOR_EMPLOYEE: 'SENIOR_EMPLOYEE',
  CONTRACTOR: 'CONTRACTOR',
  INTERN: 'INTERN',
  CONSULTANT: 'CONSULTANT',
  CUSTOM: 'CUSTOM'
};

export const OrganizationTypes = {
  COMPANY: 'COMPANY',
  STARTUP: 'STARTUP',
  NGO: 'NGO',
  NON_PROFIT: 'NON_PROFIT',
  GOVERNMENT: 'GOVERNMENT',
  EDUCATIONAL: 'EDUCATIONAL',
  HEALTHCARE: 'HEALTHCARE',
  OTHER: 'OTHER'
};

export const OrganizationSizes = ['1-10', '11-50', '51-200', '201-500', '500+'];

export const Industries = [
  'Technology',
  'Finance',
  'Healthcare',
  'Education',
  'Manufacturing',
  'Retail',
  'Hospitality',
  'Consulting',
  'Media & Entertainment',
  'Real Estate',
  'Transportation',
  'Agriculture',
  'Energy',
  'Construction',
  'Other'
];

// Mock Users (reuse from main app, add work context)
export const mockWorkUsers = [
  {
    id: 'user-1',
    first_name: 'Oleksandr',
    last_name: 'Kovalenko',
    email: 'oleksandr@zion.city',
    avatar_url: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Oleksandr'
  },
  {
    id: 'user-2',
    first_name: 'Kateryna',
    last_name: 'Shevchenko',
    email: 'kateryna@zion.city',
    avatar_url: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Kateryna'
  },
  {
    id: 'user-3',
    first_name: 'Dmytro',
    last_name: 'Petrenko',
    email: 'dmytro@techcorp.ua',
    avatar_url: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Dmytro'
  },
  {
    id: 'user-4',
    first_name: 'Olena',
    last_name: 'Ivanova',
    email: 'olena@innovate.ua',
    avatar_url: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Olena'
  },
  {
    id: 'user-5',
    first_name: 'Andriy',
    last_name: 'Bondarenko',
    email: 'andriy@startup.ua',
    avatar_url: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Andriy'
  }
];

// Mock Organizations
export const mockOrganizations = [
  {
    id: 'org-1',
    name: 'ZION.CITY',
    organization_type: 'STARTUP',
    description: 'Революционная платформа цифровой экосистемы, объединяющая граждан, бизнес и правительство в Ростовской области.',
    industry: 'Technology',
    organization_size: '11-50',
    founded_year: 2024,
    website: 'https://zion.city',
    official_email: 'info@zion.city',
    address_street: 'Проспект Буденновский, 15',
    address_city: 'Ростов-на-Дону',
    address_state: 'Ростовская область',
    address_country: 'Россия',
    address_postal_code: '344002',
    logo_url: 'https://api.dicebear.com/7.x/shapes/svg?seed=ZIONCITY',
    banner_url: 'https://images.unsplash.com/photo-1557804506-669a67965ba0?w=1200&h=400&fit=crop',
    is_private: false,
    allow_public_discovery: true,
    member_count: 12,
    creator_id: 'user-1',
    created_at: '2024-01-15T10:00:00Z',
    updated_at: '2025-01-20T15:30:00Z'
  },
  {
    id: 'org-2',
    name: 'ТехКорп Россия',
    organization_type: 'COMPANY',
    description: 'Ведущая компания по разработке программного обеспечения, специализирующаяся на корпоративных решениях и цифровой трансформации.',
    industry: 'Technology',
    organization_size: '51-200',
    founded_year: 2015,
    website: 'https://techcorp.ru',
    official_email: 'contact@techcorp.ru',
    address_street: 'Большая Садовая улица, 42',
    address_city: 'Ростов-на-Дону',
    address_state: 'Ростовская область',
    address_country: 'Россия',
    address_postal_code: '344006',
    logo_url: 'https://api.dicebear.com/7.x/shapes/svg?seed=TechCorp',
    banner_url: 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=1200&h=400&fit=crop',
    is_private: false,
    allow_public_discovery: true,
    member_count: 87,
    creator_id: 'user-3',
    created_at: '2015-06-10T09:00:00Z',
    updated_at: '2025-01-18T11:20:00Z'
  },
  {
    id: 'org-3',
    name: 'Инновационные Решения',
    organization_type: 'STARTUP',
    description: 'Инновационные решения в области ИИ и машинного обучения для бизнеса по всей России.',
    industry: 'Technology',
    organization_size: '11-50',
    founded_year: 2022,
    website: 'https://innovate.ru',
    official_email: 'hello@innovate.ru',
    address_street: 'Улица Суворова, 8',
    address_city: 'Ростов-на-Дону',
    address_state: 'Ростовская область',
    address_country: 'Россия',
    address_postal_code: '344022',
    logo_url: 'https://api.dicebear.com/7.x/shapes/svg?seed=Innovate',
    banner_url: 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=1200&h=400&fit=crop',
    is_private: false,
    allow_public_discovery: true,
    member_count: 24,
    creator_id: 'user-4',
    created_at: '2022-03-20T14:00:00Z',
    updated_at: '2025-01-19T16:45:00Z'
  },
  {
    id: 'org-4',
    name: 'Ростовский Сельскохозяйственный Кооператив',
    organization_type: 'NON_PROFIT',
    description: 'Поддержка местных фермеров и устойчивого сельского хозяйства в Ростовской области.',
    industry: 'Agriculture',
    organization_size: '51-200',
    founded_year: 1998,
    website: 'https://rostov-agro.ru',
    official_email: 'info@rostov-agro.ru',
    address_street: 'Площадь Свободы, 120',
    address_city: 'Ростов-на-Дону',
    address_state: 'Ростовская область',
    address_country: 'Россия',
    address_postal_code: '344000',
    logo_url: 'https://api.dicebear.com/7.x/shapes/svg?seed=AgroCoop',
    banner_url: 'https://images.unsplash.com/photo-1500382017468-9049fed747ef?w=1200&h=400&fit=crop',
    is_private: false,
    allow_public_discovery: true,
    member_count: 156,
    creator_id: 'user-5',
    created_at: '1998-08-01T08:00:00Z',
    updated_at: '2025-01-15T10:30:00Z'
  }
];

// Mock Organization Members
export const mockMembers = [
  // ZION.CITY Members
  {
    id: 'member-1',
    organization_id: 'org-1',
    user_id: 'user-1',
    role: 'CEO',
    custom_role_name: null,
    department: 'Executive',
    team: null,
    job_title: 'Chief Executive Officer',
    start_date: '2024-01-15',
    end_date: null,
    is_current: true,
    can_post: true,
    can_invite: true,
    is_admin: true,
    status: 'ACTIVE',
    created_at: '2024-01-15T10:00:00Z'
  },
  {
    id: 'member-2',
    organization_id: 'org-1',
    user_id: 'user-2',
    role: 'CTO',
    custom_role_name: null,
    department: 'Engineering',
    team: 'Backend Team',
    job_title: 'Chief Technology Officer',
    start_date: '2024-01-20',
    end_date: null,
    is_current: true,
    can_post: true,
    can_invite: true,
    is_admin: true,
    status: 'ACTIVE',
    created_at: '2024-01-20T11:00:00Z'
  },
  {
    id: 'member-3',
    organization_id: 'org-1',
    user_id: 'user-3',
    role: 'SENIOR_EMPLOYEE',
    custom_role_name: null,
    department: 'Engineering',
    team: 'Frontend Team',
    job_title: 'Senior Frontend Developer',
    start_date: '2024-02-01',
    end_date: null,
    is_current: true,
    can_post: true,
    can_invite: false,
    is_admin: false,
    status: 'ACTIVE',
    created_at: '2024-02-01T09:00:00Z'
  },
  // TechCorp Members
  {
    id: 'member-4',
    organization_id: 'org-2',
    user_id: 'user-3',
    role: 'DIRECTOR',
    custom_role_name: null,
    department: 'Engineering',
    team: null,
    job_title: 'Director of Engineering',
    start_date: '2018-03-15',
    end_date: null,
    is_current: true,
    can_post: true,
    can_invite: true,
    is_admin: true,
    status: 'ACTIVE',
    created_at: '2018-03-15T10:00:00Z'
  },
  {
    id: 'member-5',
    organization_id: 'org-2',
    user_id: 'user-1',
    role: 'CONSULTANT',
    custom_role_name: null,
    department: 'Strategy',
    team: null,
    job_title: 'Digital Transformation Consultant',
    start_date: '2023-06-01',
    end_date: null,
    is_current: true,
    can_post: true,
    can_invite: false,
    is_admin: false,
    status: 'ACTIVE',
    created_at: '2023-06-01T14:00:00Z'
  }
];

// Mock Organization Posts
export const mockWorkPosts = [
  {
    id: 'post-1',
    organization_id: 'org-1',
    author_id: 'user-1',
    author_name: 'Oleksandr Kovalenko',
    author_role: 'CEO',
    author_avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Oleksandr',
    content: 'Exciting news! ZION.CITY has just completed Phase 4 of the Family Module. We\'re revolutionizing how families connect digitally in the Kherson region. 🚀',
    media_urls: ['https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=800&h=600&fit=crop'],
    likes_count: 24,
    comments_count: 8,
    shares_count: 3,
    visibility: 'PUBLIC',
    created_at: '2025-01-20T14:30:00Z',
    is_pinned: true
  },
  {
    id: 'post-2',
    organization_id: 'org-1',
    author_id: 'user-2',
    author_name: 'Kateryna Shevchenko',
    author_role: 'CTO',
    author_avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Kateryna',
    content: 'Our engineering team is growing! We\'re building cutting-edge technology that will transform the digital landscape. Join us on this journey!',
    media_urls: [],
    likes_count: 15,
    comments_count: 4,
    shares_count: 1,
    visibility: 'PUBLIC',
    created_at: '2025-01-19T10:15:00Z',
    is_pinned: false
  },
  {
    id: 'post-3',
    organization_id: 'org-2',
    author_id: 'user-3',
    author_name: 'Dmytro Petrenko',
    author_role: 'Director',
    author_avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Dmytro',
    content: 'TechCorp Ukraine celebrates 10 years of innovation! Proud of our team and what we\'ve built together. Here\'s to the next decade! 🎉',
    media_urls: ['https://images.unsplash.com/photo-1511795409834-ef04bbd61622?w=800&h=600&fit=crop'],
    likes_count: 87,
    comments_count: 23,
    shares_count: 12,
    visibility: 'PUBLIC',
    created_at: '2025-01-18T16:00:00Z',
    is_pinned: true
  }
];

// Helper function to get user's organizations
export const getUserOrganizations = (userId) => {
  const userMemberships = mockMembers.filter(m => m.user_id === userId && m.is_current);
  return userMemberships.map(membership => {
    const org = mockOrganizations.find(o => o.id === membership.organization_id);
    return {
      ...org,
      user_role: membership.role,
      user_custom_role_name: membership.custom_role_name,
      user_department: membership.department,
      user_team: membership.team,
      user_job_title: membership.job_title,
      user_is_admin: membership.is_admin,
      user_can_invite: membership.can_invite,
      user_can_post: membership.can_post
    };
  });
};

// Helper function to get organization members with user details
export const getOrganizationMembers = (organizationId) => {
  const members = mockMembers.filter(m => m.organization_id === organizationId);
  return members.map(member => {
    const user = mockWorkUsers.find(u => u.id === member.user_id);
    return {
      ...member,
      user_first_name: user?.first_name,
      user_last_name: user?.last_name,
      user_email: user?.email,
      user_avatar_url: user?.avatar_url
    };
  });
};

// Helper function to group members by department
export const getMembersByDepartment = (organizationId) => {
  const members = getOrganizationMembers(organizationId);
  const grouped = {};
  
  members.forEach(member => {
    const dept = member.department || 'No Department';
    if (!grouped[dept]) {
      grouped[dept] = [];
    }
    grouped[dept].push(member);
  });
  
  return grouped;
};

// Helper function to get organization posts
export const getOrganizationPosts = (organizationId) => {
  return mockWorkPosts.filter(p => p.organization_id === organizationId);
};

// Helper function to search organizations
export const searchOrganizations = (query, type = null) => {
  let results = mockOrganizations.filter(org => 
    org.name.toLowerCase().includes(query.toLowerCase()) ||
    org.description.toLowerCase().includes(query.toLowerCase())
  );
  
  if (type) {
    results = results.filter(org => org.organization_type === type);
  }
  
  return results;
};
