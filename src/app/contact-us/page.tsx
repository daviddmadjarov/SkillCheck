import { LegalPage } from '../legal-page';

export const metadata = {
  title: 'Contact Us | SkillCheck',
};

export default function ContactUsPage() {
  return (
    <LegalPage
      title="Contact Us"
      kicker="Support"
      intro="Got a question, found a bug, or need help with your account? Reach out via email and we will get back to you as soon as possible. We typically respond within 48 hours."
      lastUpdated="2026-06-13"
      sections={[
        {
          title: 'Email',
          body: [
            'All inquiries: marketcapgame@gmail.com',
            'This address covers general support, privacy/GDPR requests, and business or advertising questions.',
            'We are a small operation — a solo developer maintaining SkillCheck in his spare time. Every message is read and responded to personally.',
          ],
        },
        {
          title: 'What to include',
          body: [
            'For game or score issues: tell us the game name (Reaction Protocol, Aim Assessment, etc.), what happened, and the username or email on your account.',
            'For privacy or data deletion requests: include the email address or username associated with your account so we can locate the record.',
            'For bug reports: describe the steps to reproduce the issue and include your browser and operating system if relevant. Screenshots are always helpful.',
            'For feature suggestions: describe what you would like to see added and why. We welcome all ideas but cannot guarantee implementation.',
          ],
        },
        {
          title: 'Response times',
          body: [
            'We aim to respond within 48 hours on weekdays.',
            'Privacy and data deletion requests are processed within 30 days as required by GDPR.',
            'If you have not heard back within a week, please follow up — your message may have been caught by a spam filter.',
          ],
        },
      ]}
    />
  );
}
