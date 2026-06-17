'use client';

import { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/hooks/useAuth';

// Static English fallbacks — used when translation_keys table is empty or query fails
const EN: Record<string, string> = {
  'nav.dashboard': 'Dashboard', 'nav.projects': 'Projects', 'nav.community': 'Community',
  'nav.notifications': 'Notifications', 'nav.messages': 'Messages', 'nav.settings': 'Settings',
  'nav.admin': 'Admin Panel', 'nav.translations': 'Translator Hub', 'nav.ideas': 'Ideas',
  'nav.about': 'About', 'nav.quotes': 'Quotes', 'nav.company': 'Company', 'nav.blog': 'Blog',
  'nav.pro': 'Pro', 'nav.new_project': 'New Project', 'nav.sign_out': 'Sign Out',

  'auth.login': 'Log In', 'auth.register': 'Sign Up', 'auth.forgot_password': 'Forgot Password?',
  'auth.email': 'Email', 'auth.password': 'Password', 'auth.confirm_password': 'Confirm Password',
  'auth.full_name': 'Full Name', 'auth.welcome_back': 'Welcome Back', 'auth.create_account': 'Create Account',
  'auth.no_account': 'No account? Create one', 'auth.has_account': 'Have an account? Sign in',
  'auth.signing_in': 'Signing in...', 'auth.creating_account': 'Creating Account...',
  'auth.verify_email': 'Verify Email', 'auth.check_email': 'CHECK YOUR EMAIL',
  'auth.verification_sent': 'We sent a verification link to',
  'auth.click_to_activate': 'Click it to activate your account.',
  'auth.back_to_signin': 'Back to sign in', 'auth.password_reset': 'Password Reset',
  'auth.reset_instruction': "Enter your email and we'll send you a reset link.",
  'auth.send_reset_link': 'Send Reset Link', 'auth.sending': 'Sending...',
  'auth.remember_it': 'Remember it? Sign in', 'auth.reset_link_sent': 'Reset Link Sent',
  'auth.reset_check_inbox': 'If an account exists for',
  'auth.reset_check_spam': 'we sent a password reset link. Check your inbox and spam folder.',
  'auth.free_no_card': 'Free. No card. Takes about ten seconds.',
  'auth.agree_terms': 'I agree to the Terms of Service and Privacy Policy',
  'auth.error_incorrect': 'Incorrect email or password. Please try again.',
  'auth.error_unverified': 'Please verify your email address before signing in.',
  'auth.error_too_many': 'Too many attempts. Please wait a few minutes.',
  'auth.error_network': 'Network error — please check your connection and try again.',
  'auth.error_no_account': 'No account found with that email address.',
  'auth.error_name_required': 'Please enter your full name.',
  'auth.error_email_required': 'Please enter your email address.',
  'auth.error_email_invalid': 'Please enter a valid email address.',
  'auth.error_password_required': 'Please enter a password.',
  'auth.error_terms_required': 'Please agree to the Terms of Service to continue.',
  'auth.error_email_exists': 'An account with this email already exists. Try signing in instead.',
  'auth.error_password_short': 'Password is too short. Use at least 8 characters.',
  'auth.password_rules': 'Password must contain:',
  'auth.password_rule_length': '8+ characters', 'auth.password_rule_upper': 'Uppercase letter',
  'auth.password_rule_lower': 'Lowercase letter', 'auth.password_rule_number': 'Number',
  'auth.password_rule_special': 'Special character',

  'dashboard.title': 'Dashboard', 'dashboard.welcome_back': 'WELCOME BACK',
  'dashboard.your_projects': 'Your film projects and recent work', 'dashboard.projects': 'Projects',
  'dashboard.in_dev': 'In Dev', 'dashboard.in_prod': 'In Prod', 'dashboard.done': 'Done',
  'dashboard.continue_writing': 'Continue Writing', 'dashboard.last_edited': 'Last edited',
  'dashboard.search_projects': 'Search projects...', 'dashboard.recently_viewed': 'Recently Viewed',
  'dashboard.clear': 'Clear', 'dashboard.my_projects': 'My Projects',
  'dashboard.new_folder': 'New Folder', 'dashboard.folder_name': 'Folder name…',
  'dashboard.no_projects': 'No projects yet',
  'dashboard.create_first': 'Create your first screenplay project to get started',
  'dashboard.create_first_project': 'Create First Project',
  'dashboard.no_match': 'No projects match your filters.', 'dashboard.clear_filters': 'Clear filters',
  'dashboard.unfiled': 'Unfiled', 'dashboard.move_to_folder': 'Move to folder',
  'dashboard.remove_from_folder': 'Remove from folder',
  'dashboard.delete_folder': 'Delete this folder? Projects inside will be unfiled.',

  'new_project.title': 'What are you creating?', 'new_project.details': 'Project Details',
  'new_project.from_template': 'Start from template',
  'new_project.choose_type': 'Choose the type of project you want to create.',
  'new_project.project_title': 'Project Title', 'new_project.logline': 'Logline',
  'new_project.genre': 'Genre', 'new_project.create_for': 'Create for',
  'new_project.personal': 'Personal', 'new_project.create': 'Create Project',
  'new_project.failed': 'Failed to create project. Please try again.',

  'project.title': 'Project', 'project.logline': 'Logline', 'project.genre': 'Genre',
  'project.format': 'Format', 'project.status': 'Status', 'project.team': 'Team',
  'project.share': 'Share', 'project.delete': 'Delete', 'project.settings': 'Project Settings',
  'project.save': 'Save', 'project.saving': 'Saving...', 'project.saved': 'Changes saved',
  'project.status_development': 'Development', 'project.status_pre_production': 'Pre-Production',
  'project.status_production': 'Production', 'project.status_post_production': 'Post-Production',
  'project.status_completed': 'Completed', 'project.status_archived': 'Archived',
  'project.type_film': 'Film', 'project.type_tv': 'TV', 'project.type_audio': 'Audio',
  'project.type_stage': 'Stage', 'project.type_youtube': 'YouTube',
  'project.type_tiktok': 'TikTok', 'project.type_podcast': 'Podcast',

  'script.title': 'Script', 'script.add_element': 'Add Element',
  'script.scene_heading': 'Scene Heading', 'script.action': 'Action',
  'script.character': 'Character', 'script.dialogue': 'Dialogue',
  'script.parenthetical': 'Parenthetical', 'script.transition': 'Transition',
  'script.save': 'Save script', 'script.search': 'Search in script',
  'script.export_pdf': 'Export to PDF', 'script.new_element': 'New element',
  'script.cycle_type': 'Cycle element type', 'script.draft_snapshot': 'Save draft snapshot',

  'characters.title': 'Characters', 'characters.delete_confirm': 'Delete this character?',
  'characters.filter_all': 'All', 'characters.filter_protagonist': 'Protagonist',
  'characters.filter_antagonist': 'Antagonist', 'characters.filter_main': 'Main',
  'characters.filter_supporting': 'Supporting', 'characters.filter_minor': 'Minor',

  'scenes.title': 'Scenes', 'scenes.int': 'INT', 'scenes.ext': 'EXT', 'scenes.int_ext': 'INT/EXT',

  'team.title': 'Team', 'team.members': 'members', 'team.online': 'online',
  'team.invite': 'Invite Member', 'team.role_owner': 'Owner', 'team.role_admin': 'Admin',
  'team.role_writer': 'Writer', 'team.role_editor': 'Editor', 'team.role_viewer': 'Viewer',
  'team.desc_owner': 'Full access, can delete project',
  'team.desc_admin': 'Manage members, edit everything',
  'team.desc_writer': 'Edit scripts, characters, scenes',
  'team.desc_editor': 'Edit content, no admin access', 'team.desc_viewer': 'Read-only access',
  'team.active_now': 'Active Now', 'team.all_members': 'All Members', 'team.you': 'You',
  'team.remove_confirm': 'Remove this team member?', 'team.joined': 'Joined',

  'share.title': 'Share', 'share.links_for': 'Shareable links for',
  'share.new_link': 'New link', 'share.link_name': 'Link name',
  'share.link_placeholder': 'e.g. Director cut, Client draft…',
  'share.permissions': 'What can they see?', 'share.perm_script': 'Script',
  'share.perm_characters': 'Characters', 'share.perm_scenes': 'Scenes',
  'share.perm_schedule': 'Schedule', 'share.perm_documents': 'Documents',
  'share.perm_view_notes': 'View notes', 'share.perm_write_notes': 'Write notes',
  'share.invite_link': 'Invite link', 'share.invite_role': 'Invite role',
  'share.role_viewer': 'viewer', 'share.role_commenter': 'commenter',
  'share.role_editor': 'editor', 'share.no_links': 'No share links yet',

  'community.title': 'Community', 'community.scripts': 'COMMUNITY SCRIPTS',
  'community.discover': 'Discover, share, and collaborate on screenplays',
  'community.all_posts': 'All Posts', 'community.your_feed': 'Your Feed',
  'community.newest': 'newest', 'community.popular': 'popular', 'community.discussed': 'discussed',
  'community.categories': 'Categories', 'community.all_scripts': 'All Scripts',
  'community.finished': 'Finished Projects', 'community.challenges': 'Writing Challenges',
  'community.free_scripts': 'Free-to-Use Scripts', 'community.your_communities': 'Your Communities',
  'community.browse': 'Browse →', 'community.courses': 'Courses', 'community.enrolled': 'enrolled',
  'community.no_posts': 'No scripts shared yet',
  'community.be_first': 'Be the first to share your work with the community!',
  'community.share_script': 'Share Your Script', 'community.weekly_challenge': 'Weekly Challenge',
  'community.submit': 'Submit', 'community.view': 'View', 'community.submissions': 'submissions',
  'community.free_to_use': 'Free to Use', 'community.distros_allowed': 'Distros Allowed',
  'community.open_to_edits': 'Open to Edits',
  'community.delete_post': 'Delete this post? This cannot be undone.',

  'settings.title': 'Settings', 'settings.profile': 'Profile', 'settings.preferences': 'Preferences',
  'settings.company': 'Company', 'settings.privacy': 'Privacy & Data', 'settings.security': 'Security',
  'settings.gamification': 'Gamification', 'settings.translations': 'Translations',
  'settings.accountability': 'Accountability', 'settings.your_profile': 'Your Profile',
  'settings.full_name': 'Full Name', 'settings.display_name': 'Display Name',
  'settings.username': 'Username', 'settings.headline': 'Headline', 'settings.bio': 'Bio',
  'settings.avatar_url': 'Avatar URL', 'settings.public_profile': 'Public Profile',
  'settings.customise_profile': 'Customise how your profile appears to visitors.',
  'settings.banner_image': 'Banner Image URL', 'settings.location': 'Location',
  'settings.website': 'Website', 'settings.profile_theme': 'Profile Theme',
  'settings.social_links': 'Social Links',
  'settings.social_desc': 'Add links to your social profiles. Leave blank to hide.',
  'settings.privacy_visibility': 'Privacy & Visibility',
  'settings.privacy_desc': 'Control what others can see on your profile.',
  'settings.show_email': 'Show email on profile', 'settings.show_projects': 'Show projects',
  'settings.show_activity': 'Show activity', 'settings.allow_dms': 'Allow direct messages',
  'settings.email_notifications': 'Email Notifications',
  'settings.email_notifications_desc': 'Choose which emails you receive.',
  'settings.notif_invitations': 'Project invitations', 'settings.notif_mentions': 'Mentions & comments',
  'settings.notif_dms': 'Direct messages', 'settings.notif_support': 'Support ticket replies',
  'settings.notif_digest': 'Weekly digest', 'settings.save_profile': 'Save Profile',
  'settings.saved': '✓ Saved', 'settings.changes_saved': 'Changes saved',
  'settings.how_use': 'How do you use Screenplay Studio?',
  'settings.adjusts_layout': 'This adjusts your default workspace layout.',
  'settings.intent_writer': 'Writer', 'settings.intent_producer': 'Producer',
  'settings.intent_both': 'Both', 'settings.intent_student': 'Student',
  'settings.feature_visibility': 'Feature Visibility',
  'settings.feat_community': 'Community Hub',
  'settings.feat_community_desc': 'Share scripts, get feedback, join challenges',
  'settings.feat_production': 'Production Tools',
  'settings.feat_production_desc': 'Locations, shots, schedule, budget',
  'settings.feat_collaboration': 'Collaboration',
  'settings.feat_collaboration_desc': 'Team members, real-time editing',
  'settings.feat_accountability': 'Writing Accountability',
  'settings.feat_accountability_desc': 'Streaks, buddies, groups, activity grid',
  'settings.default_script_type': 'Default Script Type',
  'settings.script_type_desc': 'Pre-selected when you create new projects.',
  'settings.accent_color': 'Accent Color',
  'settings.accent_desc': 'Personalize the interface with your preferred color.',
  'settings.editor_style': 'Editor Style',
  'settings.editor_desc': 'Choose how the script editor looks across all your projects.',
  'settings.sidebar_tabs': 'Project Sidebar Tabs',
  'settings.sidebar_desc': 'You can also customize per-project in project settings.',
  'settings.gamification_title': 'Gamification',
  'settings.gamification_desc': 'Show your XP, level, and badges across the platform.',
  'settings.your_progress': 'Your Progress', 'settings.total_xp': 'Total XP',
  'settings.level': 'Level', 'settings.login_streak': 'Login Streak',
  'settings.your_badges': 'Your Badges',
  'settings.no_badges': 'No badges yet — keep writing!',
  'settings.language': 'Language',
  'settings.language_desc': 'Choose your preferred display language.',
  'settings.default_language': 'Default language', 'settings.add_language': 'Add Your Language',
  'settings.add_language_desc': "Don't see your language? Add it and take a quick fluency quiz.",
  'settings.translation_stats': 'Translation Stats', 'settings.languages_count': 'Languages',
  'settings.keys_count': 'Translation Keys', 'settings.language_saved': 'Language preference saved',
  'settings.export_data': 'Export Your Data',
  'settings.export_desc': 'Download all your personal data in a machine-readable format (JSON).',
  'settings.download_data': 'Download My Data', 'settings.delete_account': 'Delete Account',
  'settings.delete_desc': 'Permanently delete your account and all associated data.',
  'settings.delete_button': 'Delete My Account',
  'settings.delete_warning': 'This cannot be undone.',
  'settings.account_security': 'Account Security',
  'settings.security_desc': 'View your login history, manage active sessions.',
  'settings.open_security': 'Open Security Dashboard',
  'settings.change_password': 'Change your password to keep your account secure.',
  'settings.reset_password': 'Reset Password', 'settings.email_verified': 'Email verified',
  'settings.view_legal': 'View Legal Center →', 'settings.account_info': 'Account Info',
  'settings.save_preferences': 'Save Preferences',

  'sidebar.overview': 'Overview', 'sidebar.script': 'Script', 'sidebar.episodes': 'Episodes',
  'sidebar.arc_planner': 'Arc Planner', 'sidebar.beat_sheet': 'Beat Sheet',
  'sidebar.notes_rounds': 'Notes Rounds', 'sidebar.ideas': 'Ideas',
  'sidebar.documents': 'Documents', 'sidebar.characters': 'Characters',
  'sidebar.locations': 'Locations', 'sidebar.scenes': 'Scenes', 'sidebar.schedule': 'Schedule',
  'sidebar.budget': 'Budget', 'sidebar.breakdown': 'Breakdown', 'sidebar.call_sheet': 'Call Sheet',
  'sidebar.war_room': 'War Room', 'sidebar.on_set': 'On Set', 'sidebar.day_pack': 'Day Pack',
  'sidebar.continuity': 'Continuity', 'sidebar.table_read': 'Table Read',
  'sidebar.camera_reports': 'Camera Reports', 'sidebar.corkboard': 'Corkboard',
  'sidebar.shot_list': 'Shot List', 'sidebar.mood_board': 'Mood Board',
  'sidebar.storyboard': 'Storyboard', 'sidebar.mind_map': 'Mind Map',
  'sidebar.crew_view': 'Crew View', 'sidebar.gear': 'Gear', 'sidebar.chat': 'Chat',
  'sidebar.comments': 'Comments', 'sidebar.team': 'Team', 'sidebar.casting': 'Casting',
  'sidebar.export': 'Export', 'sidebar.share': 'Share', 'sidebar.submissions': 'Submissions',
  'sidebar.press_kit': 'Press Kit', 'sidebar.branding': 'Custom Branding',
  'sidebar.analytics': 'Analytics', 'sidebar.reports': 'Reports', 'sidebar.treatment': 'Treatment',
  'sidebar.coverage': 'Script Coverage', 'sidebar.analysis': 'Script Analysis',
  'sidebar.revisions': 'Revisions', 'sidebar.showcase': 'Showcase', 'sidebar.settings': 'Settings',
  'sidebar.write': 'Write', 'sidebar.plan': 'Plan', 'sidebar.on_set_cat': 'On Set',
  'sidebar.creative': 'Creative', 'sidebar.team_cat': 'Team', 'sidebar.finish': 'Finish',
  'sidebar.studio': 'Studio',

  'common.save': 'Save', 'common.cancel': 'Cancel', 'common.delete': 'Delete',
  'common.edit': 'Edit', 'common.submit': 'Submit', 'common.search': 'Search',
  'common.loading': 'Loading...', 'common.error': 'Something went wrong',
  'common.success': 'Success!', 'common.confirm': 'Confirm', 'common.back': 'Back',
  'common.next': 'Next', 'common.previous': 'Previous', 'common.close': 'Close',
  'common.yes': 'Yes', 'common.no': 'No', 'common.add': 'Add', 'common.rename': 'Rename',
  'common.copy': 'Copy', 'common.paste': 'Paste', 'common.undo': 'Undo',
  'common.redo': 'Redo', 'common.refresh': 'Refresh', 'common.export': 'Export',
  'common.import': 'Import', 'common.filter': 'Filter', 'common.sort': 'Sort',
  'common.all': 'All', 'common.none': 'None', 'common.enabled': 'Enabled',
  'common.disabled': 'Disabled', 'common.active': 'Active', 'common.inactive': 'Inactive',
  'common.online': 'Online', 'common.offline': 'Offline', 'common.view_all': 'View All',
  'common.show_more': 'Show More', 'common.show_less': 'Show Less',
  'common.no_results': 'No results found', 'common.required': 'Required',
  'common.optional': 'Optional', 'common.characters': 'characters', 'common.words': 'words',
  'common.minutes': 'minutes', 'common.hours': 'hours', 'common.days': 'days',

  'translations.title': 'Translator Hub',
  'translations.description': 'Help translate Screenplay Studio into your language',
  'translations.your_language': 'Your Language', 'translations.add_language': 'Add Language',
  'translations.progress': 'Translation Progress', 'translations.suggest': 'Suggest Translation',
  'translations.vote': 'Vote', 'translations.winning': 'Winning',
  'translations.pending': 'Pending Review', 'translations.contributors': 'Top Contributors',
  'translations.no_suggestions': 'No suggestions yet. Be the first!',
  'translations.agree_first': 'You must agree to the translation guidelines before contributing',
  'translations.agree_button': 'I Agree to the Guidelines',
  'translations.translated': 'translated', 'translations.suggestion': 'Your suggestion',
  'translations.votes': 'votes',

  'support.title': 'Support', 'support.contact': 'Contact Us',
  'support.faq': 'FAQ', 'support.docs': 'Documentation',
  'pro.title': 'Go Pro', 'pro.subtitle': 'Unlock all features for your projects',
  'pro.current_plan': 'Current Plan', 'pro.upgrade': 'Upgrade',
  'pro.manage': 'Manage Subscription',

  'onboarding.welcome': 'Welcome to Screenplay Studio',
  'onboarding.lets_get_started': "Let's get you set up",
  'onboarding.finish_setup': 'Finish Setup', 'onboarding.skip': 'Skip for now',

  'notifications.title': 'Notifications', 'notifications.mark_all_read': 'Mark all as read',
  'notifications.no_notifications': 'No notifications yet',
  'messages.title': 'Messages', 'messages.no_messages': 'No messages yet',
  'messages.new_message': 'New Message', 'messages.search': 'Search conversations...',

  'banned.title': 'Account Banned', 'banned.reason': 'Reason',
  'suspended.title': 'Account Suspended', 'suspended.reason': 'Reason',
  'suspended.expires': 'Expires',

  'shortcuts.title': 'Keyboard Shortcuts',
  'shortcuts.search': 'Quick search / command palette',
  'shortcuts.show': 'Show keyboard shortcuts',
  'shortcuts.new_project': 'New project (dashboard)',
  'shortcuts.close': 'Close modal / cancel',
  'shortcuts.move_up': 'Move up', 'shortcuts.move_down': 'Move down',
};

interface TranslationEntry {
  translated: string;
  source: string;
}

interface TranslationMap {
  [key: string]: TranslationEntry;
}

interface TranslationContextType {
  lang: string;
  t: (key: string, fallback?: string) => string;
  loading: boolean;
  reload: () => void;
}

const TranslationContext = createContext<TranslationContextType>({
  lang: 'en',
  t: (_key: string, fallback?: string) => fallback || _key,
  loading: true,
  reload: () => {},
});

export function useTranslation() {
  return useContext(TranslationContext);
}

export function TranslationProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [translations, setTranslations] = useState<TranslationMap>({});
  const [lang, setLang] = useState('en');
  const [loading, setLoading] = useState(true);
  const prevLang = useRef<string>('');

  const loadTranslations = useCallback(async (language: string) => {
    const supabase = createClient();
    setLoading(true);

    // Build base map from static English fallbacks
    const map: TranslationMap = {};
    for (const [key, sourceText] of Object.entries(EN)) {
      map[key] = { translated: sourceText, source: sourceText };
    }

    // Try loading from DB to get any extra keys and override with source_text
    try {
      const { data: allKeys } = await supabase
        .from('translation_keys')
        .select('key, source_text');

      if (allKeys) {
        allKeys.forEach((k: { key: string; source_text: string }) => {
          map[k.key] = { translated: k.source_text, source: k.source_text };
        });
      }
    } catch {
      // Static fallbacks are already in the map
    }

    // If a non-English language, overlay its winning translations
    if (language && language !== 'en') {
      setLang(language);
      try {
        const { data: winners } = await supabase
          .from('translation_winners')
          .select('key, translated_text, source_text')
          .eq('language', language);

        if (winners) {
          winners.forEach((w: { key: string; translated_text: string; source_text: string }) => {
            map[w.key] = { translated: w.translated_text, source: w.source_text };
          });
        }
      } catch {
        // English fallbacks remain
      }
    } else {
      setLang('en');
    }

    setTranslations(map);
    setLoading(false);
  }, []);

  useEffect(() => {
    const preferred = user?.preferred_language || 'en';
    if (preferred !== prevLang.current) {
      prevLang.current = preferred;
      loadTranslations(preferred);
    }
  }, [user?.preferred_language, loadTranslations]);

  const reload = useCallback(() => {
    const preferred = user?.preferred_language || 'en';
    prevLang.current = '';
    loadTranslations(preferred);
  }, [user?.preferred_language, loadTranslations]);

  const t = useCallback((key: string, fallback?: string): string => {
    const entry = translations[key];
    if (entry) return entry.translated;
    return fallback || key;
  }, [translations]);

  return (
    <TranslationContext.Provider value={{ lang, t, loading, reload }}>
      {children}
    </TranslationContext.Provider>
  );
}
