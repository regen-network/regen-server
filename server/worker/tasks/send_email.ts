import * as AWS from 'aws-sdk';
import * as nodemailer from 'nodemailer';
import mjml2html = require('mjml');
import { template as lodashTemplate } from 'lodash';
import { promises as fsp } from 'fs';
import * as html2text from 'html-to-text';
import { Task } from 'graphile-worker';
const { readFile } = fsp;

// create Nodemailer SES transporter
const transporter: nodemailer.Transporter = nodemailer.createTransport({
  SES: new AWS.SES({
    apiVersion: '2010-12-01',
    accessKeyId: process.env.AWS_SES_KEY_ID || '',
    secretAccessKey: process.env.AWS_SES_ACCESS_KEY || '',
    region: process.env.AWS_REGION || 'us-east-1',
  }),
});

export interface SendEmailPayload {
  options: {
    from?: string;
    to: string | string[];
    subject: string;
  };
  template: string;
  variables: {
    [varName: string]: any;
  };
}

const task: Task = async inPayload => {
  const payload: SendEmailPayload = inPayload as any;
  const { options: inOptions, template, variables } = payload;
  const options = {
    from: `Regen Network <${process.env.SES_EMAIL}>`,
    ...inOptions,
  };
  if (template) {
    const templateFn = await loadTemplate(template);
    let html = await templateFn(variables);
    html = html.replace(/&lt;i&gt;/g, '<i>').replace(/&lt;\/i&gt;/g, '</i>');

    const html2textableHtml = html.replace(/(<\/?)div/g, '$1p');
    const text = html2text
      .fromString(html2textableHtml, {
        wordwrap: 120,
      })
      .replace(/\n\s+\n/g, '\n\n');
    Object.assign(options, { html, text });
  }
  try {
    const info = await transporter.sendMail(options);
  } catch (e) {
    console.log(e);
  }
};

export default task;

const templatePromises = {};
function loadTemplate(template: string): Promise {
  if (!templatePromises[template]) {
    templatePromises[template] = (async () => {
      if (!template.match(/^[a-zA-Z0-9_.-]+$/)) {
        throw new Error(`Disallowed template name '${template}'`);
      }
      const templateString = await readFile(
        `${__dirname}/../templates/${template}`,
        'utf8',
      );
      const templateFn = lodashTemplate(templateString, {
        escape: /\[\[([\s\S]+?)\]\]/g,
      });
      return (variables: { [varName: string]: any }) => {
        const mjml = templateFn(variables);
        const { html, errors } = mjml2html(mjml);
        if (errors && errors.length) {
          console.error(errors);
        }
        return html;
      };
    })();
  }
  return templatePromises[template];
}

export const dateFormat = new Intl.DateTimeFormat('en', {
  year: 'numeric',
  month: 'short',
  day: '2-digit',
});

export const numberFormat = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 2,
});
