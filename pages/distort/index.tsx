/*
 * @Author: hongbin
 * @Date: 2024-12-23 08:14:44
 * @LastEditors: hongbin
 * @LastEditTime: 2024-12-30 19:22:08
 * @Description:
 */
import styled, { css } from "styled-components";
import Layout from "@/src/components/Three/Layout";
import { Main } from "./main";
import { FlexDiv, A } from "@/src/styled";

interface IProps {}

const Index: React.FC<IProps> = () => {
    return (
        <>
            <Layout
                main={Main}
                // title="堆叠、混合和熔化"
                seoTitle="堆叠、混合和熔化"
                style={css`
                    /* width: 90vw;
                    height: 80vh; */
                    width: 100vw;
                    height: 100vh;
                    position: fixed;
                    z-index: 1;
                    border: none;
                `}
                // desc={
                //     <FlexDiv center>
                //         <span>COPY BY &nbsp;</span>
                //         <A target="_blank" href="https://homunculus.jp">
                //             homunculus.jp
                //         </A>
                //     </FlexDiv>
                // }
            />
            <ScrollElement />
            <PopUp />
        </>
    );
};

export default Index;

const ScrollElement = styled.div.attrs({ id: "ScrollElement" })`
    height: 100vh;
`;

const PopUp: React.FC<IProps> = () => {
    return (
        <Container>
            <img alt="" src="" id="tempIMG" />
            <FlexDiv column>
                <h1> xxxxxxxx </h1>
                <span>xxxxxxxxxxxxxxxxxxxxxxxxxxx</span>
                <span>xxxxxxxxxxxxxxxxxxxxxxxxxxx</span>
                <span>xxxxxxxxxxxxxxxxxxxxxxxxxxx</span>
                <br />
            </FlexDiv>
            <FlexDiv>
                <button
                    onClick={() => {
                        const tempIMG = document.getElementById("tempIMG") as HTMLImageElement;

                        tempIMG.parentElement!.style.left = "-100%";
                    }}
                    style={{
                        width: "10vw",
                        padding: "3px 10px",
                    }}
                >
                    关闭
                </button>
            </FlexDiv>
        </Container>
    );
};

const Container = styled.div`
    height: 100vh;
    width: 100vw;
    background: #000000b3;
    position: fixed;
    top: 0;
    left: -100%;
    transition: left 0.5s;
    z-index: 10;
    backdrop-filter: blur(10px);
    display: flex;
    align-items: center;
    justify-content: center;
    flex-direction: column;

    img {
        width: calc(80vw / 9 * 8);
        height: calc(80vw / 16 * 8);
    }
`;
