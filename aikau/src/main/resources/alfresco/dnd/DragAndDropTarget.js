/**
 * Copyright (C) 2005-2015 Alfresco Software Limited.
 *
 * This file is part of Alfresco
 *
 * Alfresco is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Lesser General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * Alfresco is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Lesser General Public License for more details.
 *
 * You should have received a copy of the GNU Lesser General Public License
 * along with Alfresco. If not, see <http://www.gnu.org/licenses/>.
 */

/**
 * @module alfresco/dnd/DragAndDropTarget
 * @extends external:dijit/_WidgetBase
 * @mixes external:dojo/_TemplatedMixin
 * @mixes module:alfresco/core/Core
 * @author Dave Draper
 */
define(["dojo/_base/declare",
        "dijit/_WidgetBase", 
        "dijit/_TemplatedMixin",
        "alfresco/core/CoreWidgetProcessing",
        "alfresco/core/ObjectProcessingMixin",
        "dojo/text!./templates/DragAndDropTarget.html",
        "alfresco/core/Core",
        "dojo/_base/lang",
        "dojo/_base/array",
        "dijit/registry",
        "dojo/dnd/Source",
        "dojo/dnd/Target",
        "dojo/dom-construct",
        "dojo/dom-class",
        "dojo/aspect",
        "dojo/on",
        "alfresco/dnd/Constants",
        "dojo/Deferred"], 
        function(declare, _Widget, _Templated, CoreWidgetProcessing, ObjectProcessingMixin, template, AlfCore, 
                 lang, array, registry, Source, Target, domConstruct, domClass, aspect, on, Constants, Deferred) {
   
   return declare([_Widget, _Templated, CoreWidgetProcessing, ObjectProcessingMixin, AlfCore], {
      
      /**
       * An array of the CSS files to use with this widget.
       * 
       * @instance
       * @type {Array}
       */
      cssRequirements: [{cssFile:"./css/DragAndDropTarget.css"}],
      
      /**
       * The HTML template to use for the widget.
       * @instance
       * @type {String}
       */
      templateString: template,
      
      /**
       * @instance
       * @type {boolean}
       * @default false
       */
      horizontal: false,
      
      /**
       * The target for dropping widgets onto.
       * 
       * @instance
       * @type {object}
       * @default null
       */
      previewTarget: null,
      
      /**
       * A list of the initial items to add to the drop zone when it is first created.
       * 
       * @instance
       * @type {object[]}
       * @default
       */
      initialItems: null,
      
      /**
       * The types that this drop zone will accept. By default this is set to null but if not specified
       * in the configuration this will be initialised to ["widget"].
       *
       * @instance
       * @type {string[]}
       * @default null
       */
      acceptTypes: null,

      withHandles: true,

      /**
       * @instance
       */
      postCreate: function alfresco_dnd_DragAndDropTarget__postCreate() {
         if (this.acceptTypes === null)
         {
            this.acceptTypes = ["widget"];
         }
         
         this.previewTarget = new Source(this.previewNode, { 
            accept: this.acceptTypes,
            creator: lang.hitch(this, this.creator),
            withHandles: this.withHandles,
            horizontal: this.horizontal
         });

         // Capture wrappers being selected...
         aspect.after(this.previewTarget, "onMouseDown", lang.hitch(this, this.onWidgetSelected), true);
         
         // Capture widgets being dropped...
         aspect.after(this.previewTarget, "onDrop", lang.hitch(this, this.onItemsUpdated), true);
         
         // Listen for widgets requesting to be deleted...
         on(this.previewNode, Constants.deleteItemEvent, lang.hitch(this, this.deleteItem));

         var _this = this;
         this.watch("value", function(name, oldValue, newValue) {
            _this.setValue(newValue);
         });
         // this.setValue(this.value);
      },
      
      /**
       * The widget model used to wrap each dropped item.
       * 
       * @instance
       * @type {array}
       */
      widgetsForWrappingDroppedItems: [
         {
            name: "alfresco/dnd/DroppedItemWrapper",
            config: {
               value: "{value}",
               widgets: "{widgets}"
            }
         }
      ],

      /**
       * This is the default widget model to use for each dropped item. It can be overridden if required
       * and will not be used if the data in the dropped item contains a "widgets" attribute.
       *
       * @instance
       * @type {array}
       */
      widgetsForDroppedItems: [
         {
            name: "alfresco/dnd/DroppedItem"
         }
      ],

      /**
       * Indicates whether or not to use a modelling service to render the dropped items.
       * This will result in publications being made to request the widgets to use for each
       * dropped item based on the value of the dropped item.
       *
       * @instance
       * @type {boolean}
       * @default false
       */
      useModellingService: false,

      /**
       * This function is called from the [creator]{@link module:alfresco/dnd/DragAndDropTarget#creator} function
       * when [useModellingService]{@link module:alfresco/dnd/DragAndDropTarget#useModellingService} is set to true.
       * It publishes a request for a widget model for the value of the dropped item that is expected to 
       * be serviced by a modelling service (such as the [DndModellingService]{@link module:alfresco/services/DragAndDropModellingService}).
       * 
       * @instance
       * @param {object} item The dropped item
       */
      createViaService: function alfresco_dnd_DragAndDropTarget__createViaService(item, node) {
         var promise = new Deferred();
         promise.then(lang.hitch(this, this.createDroppedItemsWidgets, item, node));
         this.alfPublish(Constants.requestWidgetsForDisplayTopic, {
            value: item.value,
            promise: promise
         });
      },

      /**
       *
       *
       * @instance
       */
      createDroppedItemsWidgets: function alfresco_dnd_DragAndDropTarget__createDroppedItemsWidgets(item, node, resolvedPromise) {
         if (resolvedPromise.widgets)
         {
            var widgetModel = lang.clone(resolvedPromise.widgets);
            // Not sure this is the ideal solution, maybe currentItem shouldn't be abused like this?
            if (this.currentItem === null || this.currentItem === undefined)
            {
               this.currentItem = {};
            }

            // Set the value to be processed...
            this.currentItem.value = item.value;

            // TODO: processInstanceTokens needs an update to substitute entire objects for strings
            //       e.g. the value should be an object and not a string
            this.processObject(["processCurrentItemTokens"], widgetModel);
            
            // Create the widgets...
            this.processWidgets(widgetModel, node);
         }
         else
         {
            this.alfLog("error", "Resolved promise did not contain a widget model", resolvedPromise, this);
         }
         
      },

      /**
       * This handles the creation of the widget in the preview panel.
       * 
       * @instance
       */
      creator: function alfresco_dnd_DragAndDropTarget__creator(item, hint) {
         var node = domConstruct.create("div");
         var clonedItem = lang.clone(item);
         if (item.value !== null && item.value !== undefined)
         {
            if (this.useModellingService === true)
            {
               this.createViaService(clonedItem, node);
            }
            else
            {
               var widgetModel = lang.clone(this.widgetsForWrappingDroppedItems);
            
               // Not sure this is the ideal solution, maybe currentItem shouldn't be abused like this?
               if (this.currentItem === null || this.currentItem === undefined)
               {
                  this.currentItem = {};
               }

               // Set the value to be processed...
               this.currentItem.value = item.value;

               // Check to see if a specific widget model has been requested for rendering the dropped item...
               // TODO Not sure that we actually care about this yet? If at all... shouldn't everything be part of the value?
               //      This might give flexibility though...
               if (item.widgets !== null && item.widgets !== undefined)
               {
                  this.currentItem.widgets = item.widgets;
               }
               else
               {
                  this.currentItem.widgets = lang.clone(this.widgetsForDroppedItems);
               }

               // TODO: processInstanceTokens needs an update to substitute entire objects for strings
               //       e.g. the value should be an object and not a string
               this.processObject(["processCurrentItemTokens"], widgetModel);
               
               // Create the widgets...
               this.processWidgets(widgetModel, node);
            }
         }

         // TODO: Specify type from item data
         // NOTE that the node returned is the firstChild of the element we created. This is because the widget is created
         // as a child of the node we passed
         return {node: node.firstChild, data: clonedItem, type: ["widget"]};
      },
      
      /**
       * Iterates over all the dropped nodes, finds the widget associated with each node and then calls
       * that widgets getValue function (if it has one). The resulting values are all pushed into an
       * array that is then returned.
       * 
       * @instance
       * @returns {array} The array of values represented by the dropped items.
       */
      getValue: function alfresco_dnd_DragAndDropTarget__getValue() {
         var value = [];
         var nodes = this.previewTarget.getAllNodes();
         array.forEach(nodes, function(node) {
            // Get the widgets for the node...
            var widget = registry.byNode(node);
            if (widget && typeof widget.getValue === "function")
            {
               value.push(widget.getValue());
            }
         }, this);
         return value;
      },

      /**
       *
       * 
       * @instance
       * @param {object} value The value to set.
       */
      setValue: function alfresco_dnd_DragAndDropTarget__setValue(value) {
         if (value !== undefined && value !== null && value !== "")
         {
            array.forEach(value, function(item) {
               var data = {
                  type: this.acceptTypes,
                  value: item
               };
               var createdItem = this.creator(data);
               this.previewTarget.insertNodes(true, [createdItem.data]);
            }, this);
         }
      },
      
      /**
       * @instance
       * @param {object} evt The event.
       */
      deleteItem: function alfresco_dnd_DragAndDropTarget__deleteItem(evt) {
         this.alfLog("log", "Delete widget request detected", evt);
         if (evt.target && 
             evt.target.id &&
             this.previewTarget.getItem(evt.target.id) &&
             evt.widgetToDelete) 
         {
            evt.widgetToDelete.destroyRecursive(false);
            // TODO: This is destroying the wrong widget - the wrapper, not the DroppedItem
            this.previewTarget.delItem(evt.target.id);
            
            // If the last item has just been deleted the add the dashed border back...
            if (this.previewTarget.getAllNodes().length === 0)
            {
               domClass.remove(this.previewNode, "containsItems");
            }
            // Emit the event to alert wrapping widgets to changes...
            this.onItemsUpdated();
         }
      },

      /**
       * Although this function's name suggests it handles an nodes selection, there is no guarantee
       * that a node has actually been selected. This is simply attached to the mouseDown event.
       * 
       * @instance
       * @param {object} evt The selection event
       */
      onWidgetSelected: function alfresco_dnd_DragAndDropTarget__onWidgetSelected(evt) {
         var selectedNodes = this.previewTarget.getSelectedNodes();
         if (selectedNodes.length > 0 && selectedNodes[0] !== null)
         {
            var selectedItem = this.previewTarget.getItem(selectedNodes[0].id);
            this.alfLog("log", "Widget selected", selectedItem);
            // this.onItemsUpdated();
            // TODO: We probably don't need to do anything when a widget is selected.
            // TODO: We probably want a pencil icon for editing, hooked into a similar function.
         }
      },

      /**
       * This function is called after a new item is dropped onto the page.
       *
       * @instance
       */
      onItemsUpdated: function alfresco_dnd_DragAndDropTarget__onItemsUpdated() {
         on.emit(this.domNode, Constants.updateItemsEvent, {
            bubbles: true,
            cancelable: true,
            widgetToDelete: this
         });

         // NOTE: This is needed to ensure that form controls are rendered correctly
         //       after being dropped onto the page...
         this.alfPublish("ALF_WIDGET_PROCESSING_COMPLETE", {}, true);
      }
   });
});