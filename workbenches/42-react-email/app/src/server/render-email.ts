import { createElement as h, type ReactNode } from "react";
import { render, toPlainText } from "@react-email/render";
import { Html } from "./vendor/html/html.js";
import { Head } from "./vendor/head/head.js";
import { Body } from "./vendor/body/body.js";
import { Container } from "./vendor/container/container.js";
import { Preview } from "./vendor/preview/preview.js";
import { Section } from "./vendor/section/section.js";
import { Text } from "./vendor/text/text.js";
import { Heading } from "./vendor/heading/heading.js";
import { Button } from "./vendor/button/button.js";
import { Hr } from "./vendor/hr/hr.js";
import { Row } from "./vendor/row/row.js";
import { Column } from "./vendor/column/column.js";
import {
  substitute,
  hrefValue,
  validateEmail,
  type EmailDoc,
  type Block,
} from "../contracts/email.ts";
export async function renderEmail(raw: EmailDoc) {
  const d = validateEmail(raw),
    selected = d.recipients.find((r) => r.id === d.selectedRecipient),
    vars = { ...d.variables, ...selected?.values },
    missing = new Set<string>();
  const replace = (s: string) => substitute(s, vars, missing);
  const paragraph = (text: string) =>
    h(
      Text,
      {
        style: {
          fontFamily: "Arial, sans-serif",
          fontSize: "15px",
          lineHeight: "26px",
          color: "#494454",
          whiteSpace: "pre-wrap",
          margin: "18px 0",
        },
      },
      replace(text),
    );
  function block(b: Block): ReactNode {
    switch (b.kind) {
      case "heading":
        return h(
          Heading,
          {
            as: "h1",
            style: {
              fontFamily: "Georgia, serif",
              fontSize: "30px",
              fontWeight: "normal",
              lineHeight: "1.35",
              letterSpacing: "-.5px",
              color: "#2d243d",
              margin: "30px 0 22px",
            },
          },
          replace(b.text),
        );
      case "text":
        return paragraph(b.text);
      case "button":
        return h(
          Section,
          { style: { margin: "25px 0" } },
          h(
            Button,
            {
              href: hrefValue(replace(b.href)),
              style: {
                backgroundColor: d.accent,
                color: "#ffffff",
                padding: "14px 22px",
                borderRadius: "4px",
                fontSize: "14px",
                textDecoration: "none",
                fontFamily: "Arial, sans-serif",
              },
            },
            replace(b.text),
          ),
        );
      case "divider":
        return h(Hr, { style: { borderColor: "#e6e1eb", margin: "28px 0" } });
      case "columns":
        return h(
          Row,
          null,
          h(
            Column,
            {
              width: "50%",
              style: { verticalAlign: "top", paddingRight: "12px" },
            },
            paragraph(b.text),
          ),
          h(
            Column,
            {
              width: "50%",
              style: { verticalAlign: "top", paddingLeft: "12px" },
            },
            paragraph(b.secondary),
          ),
        );
    }
  }
  const subject = replace(d.subject),
    preheader = replace(d.preheader);
  const html = await render(
    h(
      Html,
      { lang: "zh-CN" },
      h(
        Head,
        null,
        h("meta", {
          name: "viewport",
          content: "width=device-width,initial-scale=1",
        }),
        h("title", null, subject),
      ),
      h(Preview, null, preheader),
      h(
        Body,
        {
          style: {
            backgroundColor: "#f4f1f7",
            fontFamily: "Arial, sans-serif",
            margin: "0",
            padding: "32px 12px",
          },
        },
        h(
          Container,
          {
            style: {
              maxWidth: d.width + "px",
              backgroundColor: "#ffffff",
              padding: "34px 30px",
              borderRadius: "2px",
            },
          },
          h(
            Text,
            {
              style: {
                color: d.accent,
                fontSize: "12px",
                fontWeight: "bold",
                letterSpacing: "2px",
                margin: "0 0 26px",
              },
            },
            replace(d.brand),
          ),
          ...d.blocks.map((b) => h(Section, { key: b.id }, block(b))),
        ),
      ),
    ),
  );
  return {
    subject,
    preheader,
    html,
    text: toPlainText(html),
    missing: [...missing],
  };
}
