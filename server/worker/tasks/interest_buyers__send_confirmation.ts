import { Task } from 'graphile-worker';

import { SendEmailPayload, dateFormat, numberFormat } from './send_email';

interface InterestBuyersSendConfirmationPayload {
  email: string;
}

const task: Task = async (inPayload, { addJob }) => {
  const { email }: InterestBuyersSendConfirmationPayload = inPayload as any;
  const sendEmailPayload: SendEmailPayload = {
    options: {
      to: email,
      subject: 'Thanks for your interest in the Regen Registry!',
    },
    template: 'confirm_interest_buyers.mjml',
    variables: {},
  };
  await addJob('send_email', sendEmailPayload);
};

export default task;
