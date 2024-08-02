# 场景
## 初始化时表单时不一定为Valid，状态可以为Unknown
也就是可以设置valid，把validator的effect初始的状态设置为unknown
## 现在的联动机制会改变其中一个字段，就会立马触发其他不相关字段的联动
得有一个初始化effect的阶段
## 怎么强制触发一次强制校验，怎么触发一次只校验自身的强制校验
## Number输入怎么判断有没有输入，初始值input为空，这个时候的初始值为0；但是怎么判断用户有没有输入？
应该可以输入为undefined
## 表单怎么知道正在校验中
## 校验中应该是一个独立的状态不应覆盖原有的ValidType
## validator需要支持debounce

# 插件
能不能通过插件来支持这种额外的功能扩展

### 1. start: selectA -> selectB -> inputC
selectA change 引起 selectB value更新，再引起selectB 和 inputC的异步校验
异步校验期间，inputC发生更改，校验结果无效，如何检测
所以updateState应该跟当前的state进行绑定，因为selectB和inputC的联动校验必然在一个FieldGroup上
inputC发生人为更改，会导致FieldGroup的state更新，所以updateState可以根据这个来让校验无效
但是也有问题，inputC更改可能会导致selectB 和 inputD（假设存在多一个inputD）的校验

### 2. start inputA < inputB < inputC
inputC减少，inputB限制为inputC的大小，但是如果这个是一个异步的过程
inputA增大，inputB增大为input A的大小
这个时候如何处理
这个时候异步应该当作一个普通的修改

# effect需要一个owns字段来表明这个effects属于哪些字段？


// Field添加syncField
// Validator group使用parllel，field使用seq -- 不处理
// Field，valid，message需要重计算的，需要缓存，继承一个base类型
// 事件可以冒泡处理 不处理
// 如何解决react/vue 跟 form的交互，行为状态控制

// 加入transaction