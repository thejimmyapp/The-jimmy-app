import type { DetailedHTMLProps, HTMLAttributes } from "react";

type CustomElementProps = DetailedHTMLProps<HTMLAttributes<HTMLElement>, HTMLElement>;

declare module "react" {
  namespace JSX {
    interface IntrinsicElements {
      "cg-container": CustomElementProps;
      "cg-board": CustomElementProps;
      square: CustomElementProps;
      piece: CustomElementProps;
      coords: CustomElementProps;
      coord: CustomElementProps;
    }
  }
}

export {};
