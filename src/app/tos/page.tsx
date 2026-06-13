import { LegalPage } from '../legal-page';

export const metadata = {
  title: 'Terms of Service | SkillCheck',
};

export default function TermsPage() {
  return (
    <LegalPage
      title="Terms of Service"
      kicker="Usage Rules"
      intro="These terms govern your use of skillcheck.online. By accessing or using this site you agree to be bound by them. The site is operated by David Madjarov, Schenkendorfgasse 17/11, 1210 Wien, Austria."
      lastUpdated="2026-06-13"
      sections={[
        {
          title: 'Eligibility and acceptance',
          body: [
            'You must be at least 6 years old to use this site. By using it, you confirm you meet this requirement.',
            'If you are under the age of legal majority in your country, a parent or legal guardian must agree to these terms on your behalf.',
            'By using the site, you agree to these terms in full. If you do not agree, do not use the site.',
          ],
        },
        {
          title: 'Accounts and security',
          body: [
            'You are responsible for keeping your login credentials (email, password, or OAuth tokens) secure.',
            'You must provide accurate information when creating your account. Impersonating another person or using a misleading username is prohibited.',
            'We reserve the right to terminate or suspend accounts that violate these terms.',
          ],
        },
        {
          title: 'Gameplay, scores, and fairness',
          body: [
            'Scores, rankings, and challenge results are stored and displayed to provide the leaderboard and multiplayer features.',
            'You may not use scripts, bots, macros, modified input devices, or any other automated method to manipulate your scores or the scores of others.',
            'You may not exploit bugs, glitches, or unintended game mechanics to gain an unfair advantage. If you discover a bug, please report it instead.',
            'Score tampering, packet manipulation, or interfering with server-side score validation is strictly prohibited.',
          ],
        },
        {
          title: 'Conduct and abuse',
          body: [
            'You may not harass, threaten, or abuse other users in any multiplayer or social feature of this site.',
            'You may not attempt to disrupt, overload, or gain unauthorised access to the site or its infrastructure.',
            'Violations may result in score resets, account suspension, or permanent bans without prior notice.',
          ],
        },
        {
          title: 'Advertising',
          body: [
            'This site may display advertisements served by Google AdSense or similar networks.',
            'Ad content is controlled by the advertising provider and we are not responsible for third-party ad content.',
            'You can manage your advertising cookie preference using the Cookie Settings button in the footer.',
          ],
        },
        {
          title: 'Intellectual property',
          body: [
            'All content, game logic, visuals, and branding on skillcheck.online are owned by David Madjarov unless otherwise stated.',
            'You may not copy, reproduce, or redistribute site content without prior written permission.',
          ],
        },
        {
          title: 'Liability',
          body: [
            'The service is provided on an as-available basis. We do not guarantee uninterrupted access or error-free operation.',
            'To the extent permitted by Austrian mandatory law, the operator is not liable for indirect or consequential damages arising from use of or inability to use the site.',
          ],
        },
        {
          title: 'Governing law',
          body: [
            'These terms are governed by Austrian law. The courts of Wien, Austria have exclusive jurisdiction over any disputes arising from these terms.',
            'Mandatory consumer protection rules of your country of residence remain unaffected.',
          ],
        },
      ]}
    />
  );
}