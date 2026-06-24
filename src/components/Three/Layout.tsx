/*
 * @Author: hongbin
 * @Date: 2023-01-25 10:58:14
 * @LastEditors: hongbin
 * @LastEditTime: 2024-12-23 10:16:31
 * @Description:
 */
import { FC } from "react";
import { Container, Title, Desc } from ".";
import { NextSEO } from "../NextSEO";
import Canvas, { MainScreen } from "./Canvas";
import { css } from "styled-components";

interface IProps {
    main: typeof MainScreen;
    title?: string | JSX.Element;
    desc?: string | JSX.Element;
    seoTitle?: string;
    style?: ReturnType<typeof css>;
}

const Layout: FC<IProps> = ({ main, title, desc, seoTitle, style }) => {
    return (
        <Container>
            <NextSEO title={seoTitle} />
            {typeof title === "string" ? <Title>{title}</Title> : title}
            <Canvas main={main} style={style} />
            <br />
            {typeof desc === "string" ? <Desc>{desc}</Desc> : desc}
        </Container>
    );
};

export default Layout;
