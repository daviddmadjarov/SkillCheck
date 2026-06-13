import { LegalPage } from '../legal-page';

export const metadata = {
  title: 'Privacy Policy | SkillCheck',
};

export default function PrivacyPolicyPage() {
  return (
    <LegalPage
      title="Privacy Policy"
      kicker="Data Protection"
      intro="This policy explains what personal data skillcheck.online collects, why, and how you can control it. It applies to all visitors and registered users of this site. Austrian and EU GDPR rules apply."
      lastUpdated="2026-06-13"
      sections={[
        {
          title: 'Controller',
          body: [
            'David Madjarov, Schenkendorfgasse 17/11, 1210 Wien, Austria.',
            'Email: marketcapgame@gmail.com',
            'This policy covers all data processing on skillcheck.online, including account usage, gameplay, and advertising.',
          ],
        },
        {
          title: 'Data we collect',
          body: [
            'Account data: email address, username, and OAuth provider identifier (Google or Discord) when you register or log in.',
            'Gameplay and score data: game category, score values, round timestamps, and aggregated performance metrics tied to your user account.',
            'Session data: an authentication session token stored in a secure HTTP-only cookie to keep you signed in across page loads.',
            'Technical data: your IP address and browser/device information are logged by our infrastructure provider (Supabase) for security and abuse prevention. We do not directly access raw IP logs in normal operation.',
            'Advertising data: if you accept advertising cookies, Google AdSense places its own cookies and may collect device identifiers and browsing behaviour to show relevant ads. See Google\'s privacy policy for details.',
          ],
        },
        {
          title: 'How we use it',
          body: [
            'To provide the game experience, store your scores, operate the leaderboard, and allow multiplayer sessions.',
            'To keep your account secure and prevent cheating or abuse.',
            'To show advertisements via Google AdSense (only after you accept advertising cookies).',
            'We do not sell your personal data to third parties.',
          ],
        },
        {
          title: 'Supabase — our data processor',
          body: [
            'SkillCheck uses Supabase (Supabase Inc.) as its database and authentication backend. Your account and score data are stored on Supabase servers.',
            'Supabase acts as a data processor under our instructions and is bound by its own privacy and security terms.',
            'You can learn more at https://supabase.com/privacy',
          ],
        },
        {
          title: 'Cookies',
          body: [
            'Essential cookies: one session cookie set by Supabase to keep you logged in. This cookie is required for the site to function and does not require consent.',
            'Advertising cookies: Google AdSense cookies are loaded when you accept advertising cookies via our cookie banner. You can change this preference at any time using the Cookie Settings button in the footer.',
            'We do not use analytics or tracking tools beyond what Google AdSense may collect.',
          ],
        },
        {
          title: 'Children',
          body: [
            'This site is open to users aged 6 and above. We do not knowingly collect additional personal data from children beyond what is listed above.',
            'If you believe a child under 6 has registered an account, please contact us at marketcapgame@gmail.com and we will delete the account.',
          ],
        },
        {
          title: 'Data retention',
          body: [
            'Account and score data is retained for as long as your account is active.',
            'You may request deletion of your account and associated data at any time by emailing marketcapgame@gmail.com.',
            'Session tokens expire automatically after a short period of inactivity.',
          ],
        },
        {
          title: 'Your rights (GDPR)',
          body: [
            'You have the right to access, rectify, erase, restrict, or export your personal data.',
            'You may object to processing based on legitimate interests and withdraw consent for advertising cookies at any time.',
            'To exercise these rights, email marketcapgame@gmail.com.',
            'You also have the right to lodge a complaint with the Austrian data protection authority (Datenschutzbehörde): https://www.dsb.gv.at',
          ],
        },
      ]}
    />
  );
}