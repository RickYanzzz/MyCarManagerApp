import { openBlock, createElementBlock, createElementVNode, toDisplayString, normalizeStyle, Fragment, renderList } from "vue";
import { _ as _export_sfc } from "../../_plugin-vue_export-helper.js";
const _style_0 = { "page": { "": { "flex": 1 } }, "refresh-view": { "": { "width": "750rpx", "height": 80, "flexDirection": "row", "alignItems": "center", "justifyContent": "center" } }, "header": { "": { "height": 160, "flexDirection": "row", "alignItems": "center", "justifyContent": "center", "backgroundColor": "#f4f4f4" } }, "header-title": { "": { "fontSize": 30, "fontWeight": "bold", "color": "#444444" } }, "sticky-view": { "": { "marginLeft": 12, "marginRight": 12, "paddingTop": 20, "paddingRight": 20, "paddingBottom": 20, "paddingLeft": 20, "backgroundColor": "#EBEBEB", "borderRadius": 5 } }, "list": { "": { "flex": 1 } }, "list-item": { "": { "marginLeft": 12, "marginRight": 12, "marginTop": 12, "paddingTop": 20, "paddingRight": 20, "paddingBottom": 20, "paddingLeft": 20, "backgroundColor": "#ffffff", "borderRadius": 5 } } };
weex.requireModule("dom");
const _sfc_main = {
  data() {
    return {
      parentListId: "parentListId",
      pageHeight: 300,
      dataList: [],
      refreshing: false,
      refreshText: "",
      refreshFlag: false
    };
  },
  created() {
    for (var i = 1; i <= 32; i++) {
      this.dataList.push({
        id: i,
        name: i
      });
    }
  },
  onReady() {
    this.pageHeight = uni.getSystemInfoSync().windowHeight;
    uni.createSelectorQuery().in(this).select("#head").boundingClientRect().exec((rect) => {
      this.$refs.sublist.setSpecialEffects({
        id: this.parentListId,
        headerHeight: rect[0].height
      });
    });
  },
  methods: {
    onrefresh(e) {
      this.refreshing = true;
      this.refreshText = "刷新中...";
      setTimeout(() => {
        this.refreshing = false;
        this.refreshFlag = false;
        this.refreshText = "已刷新";
      }, 2e3);
    },
    onpullingdown(e) {
      if (this.refreshing) {
        return;
      }
      this.pulling = false;
      if (Math.abs(e.pullingDistance) > Math.abs(e.viewHeight)) {
        this.refreshFlag = true;
        this.refreshText = "释放立即刷新";
      } else {
        this.refreshFlag = false;
        this.refreshText = "下拉可以刷新";
      }
    }
  }
};
function _sfc_render(_ctx, _cache, $props, $setup, $data, $options) {
  return openBlock(), createElementBlock("list", {
    id: $data.parentListId,
    class: "page",
    bounce: false,
    isSwiperList: "true"
  }, [
    createElementVNode("refresh", {
      class: "refresh",
      onRefresh: _cache[0] || (_cache[0] = (...args) => $options.onrefresh && $options.onrefresh(...args)),
      onPullingdown: _cache[1] || (_cache[1] = (...args) => $options.onpullingdown && $options.onpullingdown(...args)),
      display: $data.refreshing ? "show" : "hide"
    }, [
      createElementVNode("div", { class: "refresh-view" }, [
        createElementVNode(
          "u-text",
          { class: "loading-text" },
          toDisplayString($data.refreshText),
          1
          /* TEXT */
        )
      ])
    ], 40, ["display"]),
    createElementVNode("cell", null, [
      createElementVNode("view", {
        id: "head",
        class: "header"
      }, [
        createElementVNode("u-text", { class: "header-title" }, "header")
      ])
    ]),
    createElementVNode("cell", null, [
      createElementVNode(
        "view",
        {
          class: "main-content",
          style: normalizeStyle("height:" + $data.pageHeight + "px")
        },
        [
          createElementVNode("view", { class: "sticky-view" }, [
            createElementVNode("u-text", { class: "sticky-title" }, "Sticky view")
          ]),
          createElementVNode(
            "list",
            {
              ref: "sublist",
              class: "list",
              offsetAccuracy: 5,
              bounce: false,
              isSwiperList: "true"
            },
            [
              (openBlock(true), createElementBlock(
                Fragment,
                null,
                renderList($data.dataList, (item, index) => {
                  return openBlock(), createElementBlock("cell", {
                    key: item.id,
                    ref_for: true,
                    ref: "item" + index,
                    onClick: _cache[2] || (_cache[2] = (...args) => _ctx.onclick && _ctx.onclick(...args))
                  }, [
                    createElementVNode("view", { class: "list-item" }, [
                      createElementVNode(
                        "u-text",
                        null,
                        toDisplayString(item.name),
                        1
                        /* TEXT */
                      )
                    ])
                  ]);
                }),
                128
                /* KEYED_FRAGMENT */
              ))
            ],
            512
            /* NEED_PATCH */
          )
        ],
        4
        /* STYLE */
      )
    ])
  ], 8, ["id"]);
}
const forms = /* @__PURE__ */ _export_sfc(_sfc_main, [["render", _sfc_render], ["styles", [_style_0]], ["__file", "/Users/wangjie/Documents/修车门店管理系统/MyCarManagerApp/pages/forms/forms.nvue"]]);
export {
  forms as default
};
