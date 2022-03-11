import { Task } from 'graphile-worker';

import { SendEmailPayload } from './send_email';

interface CreditsTransferSendConfirmationPayload {
  // purchaseId: string;
  // ownerName: string;
  // project: {
  //   name: string;
  //   image: string;
  //   location: {
  //     place_name: string;
  //   };
  //   area: number;
  //   areaUnit: string;
  //   metadata: {
  //     url: string;
  //   };
  // };
  creditClass: {
    name: string;
    metadata: {
      purchaseSummary: string;
      purchaseShare: string;
      twitterShare: string;
      telegramShare: string;
      type: string;
    };
  };
  // quantity: number;
  // amount: number;
  // currency: string;
  email: string;
  receiptUrl: string;
}

const task: Task = async (inPayload, { addJob }) => {
  const {
    email,
    creditClass,
    receiptUrl,
  }: CreditsTransferSendConfirmationPayload = inPayload as any;
  const sendEmailPayload: SendEmailPayload = {
    options: {
      to: email,
      subject: 'Thank you for regenerating the planet!',
    },
    template: 'confirm_credits_transfer.mjml',
    variables: {
      creditClassShare: creditClass.metadata.purchaseShare,
      twitterShare: creditClass.metadata.twitterShare,
      telegramShare: creditClass.metadata.telegramShare,
      receiptUrl: receiptUrl,
      summary: creditClass.metadata.purchaseSummary,
      // Variables for older email version,
      // keeping it here just in case...
      // purchaseId: purchaseId.slice(0, 8),
      // ownerName,
      // projectName: project.name,
      // projectImage: project.image,
      // projectLocation: project.location.place_name,
      // projectArea: project.area,
      // projectAreaUnit: project.areaUnit,
      // projectLink: project.metadata.url,
      // creditClassName: creditClass.name,
      // creditClassType: creditClass.metadata.type,
      // quantity,
      // amount: numberFormat.format(amount),
      // currency: currency.toUpperCase(),
      // date: dateFormat.format(new Date()),
    },
  };
  await addJob('send_email', sendEmailPayload);
};

export default task;
