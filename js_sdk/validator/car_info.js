// 表单校验规则由 schema2code 生成，不建议直接修改校验规则，而建议通过 schema2code 生成, 详情: https://uniapp.dcloud.net.cn/uniCloud/schema


const validator = {
  "carNumber": {
    "rules": [
      {
        "format": "string"
      }
    ],
    "title": "车牌号",
    "label": "车牌号"
  },
  "owner": {
    "rules": [
      {
        "format": "string"
      }
    ],
    "title": "车主姓名",
    "label": "车主姓名"
  },
  "ownerphone": {
    "rules": [
      {
        "format": "string"
      }
    ],
    "title": "联系方式",
    "label": "联系方式"
  },
  "carType": {
    "rules": [
      {
        "format": "string"
      }
    ],
    "title": "车类型",
    "label": "车类型"
  },
  "brand": {
    "rules": [
      {
        "format": "string"
      }
    ],
    "title": "车辆品牌",
    "label": "车辆品牌"
  },
  "engineNumber": {
    "rules": [
      {
        "format": "string"
      }
    ],
    "title": "发动机号",
    "label": "发动机号"
  },
  "frame": {
    "rules": [
      {
        "format": "string"
      }
    ],
    "title": "车架号",
    "label": "车架号"
  },
  "insure": {
    "rules": [
      {
        "format": "timestamp"
      }
    ],
    "title": "保险到期",
    "label": "保险到期"
  },
  "other": {
    "rules": [
      {
        "format": "string"
      }
    ],
    "title": "其他说明",
    "label": "其他说明"
  }
}

const enumConverter = {}

function filterToWhere(filter, command) {
  let where = {}
  for (let field in filter) {
    let { type, value } = filter[field]
    switch (type) {
      case "search":
        if (typeof value === 'string' && value.length) {
          where[field] = new RegExp(value)
        }
        break;
      case "select":
        if (value.length) {
          let selectValue = []
          for (let s of value) {
            selectValue.push(command.eq(s))
          }
          where[field] = command.or(selectValue)
        }
        break;
      case "range":
        if (value.length) {
          let gt = value[0]
          let lt = value[1]
          where[field] = command.and([command.gte(gt), command.lte(lt)])
        }
        break;
      case "date":
        if (value.length) {
          let [s, e] = value
          let startDate = new Date(s)
          let endDate = new Date(e)
          where[field] = command.and([command.gte(startDate), command.lte(endDate)])
        }
        break;
      case "timestamp":
        if (value.length) {
          let [startDate, endDate] = value
          where[field] = command.and([command.gte(startDate), command.lte(endDate)])
        }
        break;
    }
  }
  return where
}

export { validator, enumConverter, filterToWhere }
