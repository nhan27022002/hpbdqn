export const Cake = ({ candleVisible }: { candleVisible: boolean }) => {
  return (
    <>
      <style>{`
        .layer-bottom {
          background: linear-gradient(to bottom, #ffb6c1, #ff69b4);
        }
        .layer-middle {
          background: linear-gradient(to bottom, #ffc0cb, #ff69b4);
        }
        .layer-top {
          background: linear-gradient(to bottom, #ffe4e1, #ffb6c1);
        }
        .icing {
          background: linear-gradient(to bottom, #fff0f5, #ffc0cb);
        }
        .drip {
          background: linear-gradient(to bottom, #ffc0cb, #ff69b4);
        }
        .candle {
          background: red;
        }
      `}</style>

      <div className="cake">
        <div className="plate"></div>
        <div className="layer layer-bottom"></div>
        <div className="layer layer-middle"></div>
        <div className="layer layer-top"></div>
        <div className="icing"></div>
        <div className="drip drip1"></div>
        <div className="drip drip2"></div>
        <div className="drip drip3"></div>
        <div id="candle" className="candle">
          {candleVisible ? <div className="flame"></div> : null}
        </div>
      </div>
    </>
  );
};
